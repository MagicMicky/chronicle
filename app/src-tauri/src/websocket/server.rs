use futures_util::{SinkExt, StreamExt};
use std::sync::Arc;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{broadcast, RwLock};
use tokio_tungstenite::{accept_async, tungstenite::Message};

use super::handlers;

/// Shared application state that tracks current file and workspace
#[derive(Default)]
pub struct AppState {
    pub current_file_path: Option<String>,
    pub current_file_content: Option<String>,
    pub workspace_path: Option<String>,
    /// Last processing result from MCP server (for M6 UI display)
    pub last_processing_result: Option<serde_json::Value>,
    /// Last processing error from MCP server
    pub last_processing_error: Option<String>,
    /// Tauri app handle for emitting events to frontend
    pub app_handle: Option<tauri::AppHandle>,
}

pub type SharedAppState = Arc<RwLock<AppState>>;

/// WebSocket server that handles MCP server connections
pub struct WsServer {
    port: u16,
    app_state: SharedAppState,
    broadcast_tx: broadcast::Sender<String>,
}

impl WsServer {
    #[allow(dead_code)] // Public API for future use
    pub fn new(port: u16, app_state: SharedAppState) -> Self {
        let (broadcast_tx, _) = broadcast::channel(100);
        Self {
            port,
            app_state,
            broadcast_tx,
        }
    }

    /// Start the WebSocket server
    pub async fn start(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let addr = format!("127.0.0.1:{}", self.port);
        let listener = TcpListener::bind(&addr).await?;
        tracing::info!("WebSocket server listening on {}", addr);

        loop {
            match listener.accept().await {
                Ok((stream, peer)) => {
                    tracing::info!("New WebSocket connection from {}", peer);
                    let app_state = self.app_state.clone();
                    let broadcast_tx = self.broadcast_tx.clone();
                    tokio::spawn(handle_connection(stream, app_state, broadcast_tx));
                }
                Err(e) => {
                    tracing::error!("Failed to accept connection: {}", e);
                }
            }
        }
    }

    /// Broadcast a message to all connected clients
    #[allow(dead_code)] // Public API for future use
    pub fn broadcast(&self, msg: String) {
        if let Err(e) = self.broadcast_tx.send(msg) {
            tracing::debug!("No clients connected to receive broadcast: {}", e);
        }
    }

    /// Get a broadcast sender for use from other parts of the app
    #[allow(dead_code)] // Public API for future use
    pub fn get_broadcast_sender(&self) -> broadcast::Sender<String> {
        self.broadcast_tx.clone()
    }
}

async fn handle_connection(
    stream: TcpStream,
    app_state: SharedAppState,
    broadcast_tx: broadcast::Sender<String>,
) {
    let ws_stream = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => {
            tracing::error!("WebSocket handshake failed: {}", e);
            return;
        }
    };

    tracing::debug!("WebSocket handshake successful");

    let (mut write, mut read) = ws_stream.split();
    let mut broadcast_rx = broadcast_tx.subscribe();

    loop {
        tokio::select! {
            // Handle incoming messages from the MCP server
            msg = read.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        tracing::debug!("Received WebSocket message: {}", text);
                        if let Some(response) = handlers::handle_message(&text, app_state.clone()).await {
                            if let Err(e) = write.send(Message::Text(response)).await {
                                tracing::error!("Failed to send WebSocket response: {}", e);
                                break;
                            }
                        }
                    }
                    Some(Ok(Message::Ping(data))) => {
                        if let Err(e) = write.send(Message::Pong(data)).await {
                            tracing::error!("Failed to send pong: {}", e);
                            break;
                        }
                    }
                    Some(Ok(Message::Close(_))) => {
                        tracing::info!("WebSocket client disconnected");
                        break;
                    }
                    Some(Err(e)) => {
                        tracing::error!("WebSocket error: {}", e);
                        break;
                    }
                    None => {
                        tracing::info!("WebSocket stream ended");
                        break;
                    }
                    _ => {}
                }
            }
            // Handle broadcast messages to send to the MCP server
            broadcast_msg = broadcast_rx.recv() => {
                if let Ok(msg) = broadcast_msg {
                    tracing::debug!("Broadcasting message to WebSocket client");
                    if let Err(e) = write.send(Message::Text(msg)).await {
                        tracing::error!("Failed to send broadcast message: {}", e);
                        break;
                    }
                }
            }
        }
    }

    tracing::debug!("WebSocket connection handler finished");
}

/// Start the WebSocket server in a background task
pub fn start_ws_server(port: u16, app_state: SharedAppState) -> broadcast::Sender<String> {
    let (broadcast_tx, _) = broadcast::channel(100);
    let tx_clone = broadcast_tx.clone();

    std::thread::spawn(move || {
        let rt = match tokio::runtime::Runtime::new() {
            Ok(rt) => rt,
            Err(e) => {
                tracing::error!("Failed to create tokio runtime for WebSocket server: {}", e);
                return;
            }
        };

        rt.block_on(async {
            let server = WsServer {
                port,
                app_state,
                broadcast_tx: tx_clone,
            };

            if let Err(e) = server.start().await {
                tracing::error!("WebSocket server error: {}", e);
            }
        });
    });

    broadcast_tx
}
