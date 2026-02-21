use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use tauri::Emitter;
use tokio::sync::RwLock;

use super::AppState;

#[derive(Debug, Deserialize)]
pub struct WsMessage {
    #[serde(rename = "type")]
    pub msg_type: String,
    #[serde(default)]
    pub id: Option<String>,
    #[serde(default)]
    pub method: Option<String>,
    #[serde(default)]
    pub event: Option<String>,
    #[serde(default)]
    pub data: Option<Value>,
    #[serde(default)]
    #[allow(dead_code)] // Part of WebSocket message format, may be used by future handlers
    pub params: Option<Value>,
}

#[derive(Debug, Serialize)]
pub struct WsResponse {
    #[serde(rename = "type")]
    pub msg_type: String,
    pub id: String,
    pub result: Value,
}

pub async fn handle_message(text: &str, app_state: Arc<RwLock<AppState>>) -> Option<String> {
    let message: WsMessage = match serde_json::from_str(text) {
        Ok(msg) => msg,
        Err(e) => {
            tracing::warn!("Failed to parse WebSocket message: {}", e);
            return None;
        }
    };

    match message.msg_type.as_str() {
        "request" => handle_request(message, app_state).await,
        "push" => {
            handle_push(message, app_state).await;
            None // Push messages don't need a response
        }
        _ => {
            tracing::debug!("Ignoring message type: {}", message.msg_type);
            None
        }
    }
}

async fn handle_request(message: WsMessage, app_state: Arc<RwLock<AppState>>) -> Option<String> {
    let method = message.method.as_deref().unwrap_or("");
    let id = message.id.unwrap_or_default();

    tracing::debug!("Handling WebSocket request: {} ({})", method, id);

    let result = match method {
        "getCurrentFile" => handle_get_current_file(&app_state).await,
        "getWorkspacePath" => handle_get_workspace_path(&app_state).await,
        _ => {
            tracing::warn!("Unknown WebSocket method: {}", method);
            json!({ "error": format!("Unknown method: {}", method) })
        }
    };

    let response = WsResponse {
        msg_type: "response".to_string(),
        id,
        result,
    };

    serde_json::to_string(&response).ok()
}

async fn handle_push(message: WsMessage, app_state: Arc<RwLock<AppState>>) {
    let event = message.event.as_deref().unwrap_or("");
    let data = message.data.unwrap_or(Value::Null);

    tracing::info!("Received push event: {} with data: {:?}", event, data);

    match event {
        "processingComplete" => {
            // Store the processing result in app state and emit event to frontend
            let mut state = app_state.write().await;
            state.last_processing_result = Some(data.clone());

            // Emit Tauri event to frontend
            if let Some(ref handle) = state.app_handle {
                if let Err(e) = handle.emit("ai:processing-complete", &data) {
                    tracing::error!("Failed to emit ai:processing-complete event: {}", e);
                } else {
                    tracing::info!("Emitted ai:processing-complete event to frontend");
                }
            }
            tracing::info!("Processing complete - result stored in app state");
        }
        "processingError" => {
            let mut state = app_state.write().await;
            let error_msg = data
                .get("error")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown error")
                .to_string();
            state.last_processing_error = Some(error_msg.clone());

            // Emit Tauri event to frontend
            if let Some(ref handle) = state.app_handle {
                if let Err(e) = handle.emit("ai:processing-error", &json!({ "error": error_msg })) {
                    tracing::error!("Failed to emit ai:processing-error event: {}", e);
                } else {
                    tracing::info!("Emitted ai:processing-error event to frontend");
                }
            }
            tracing::warn!("Processing error received");
        }
        _ => {
            tracing::debug!("Unhandled push event: {}", event);
        }
    }
}

async fn handle_get_current_file(app_state: &Arc<RwLock<AppState>>) -> Value {
    let state = app_state.read().await;

    match (&state.current_file_path, &state.current_file_content) {
        (Some(path), Some(content)) => {
            let relative_path = state
                .workspace_path
                .as_ref()
                .and_then(|ws| {
                    std::path::Path::new(path)
                        .strip_prefix(ws)
                        .ok()
                        .map(|p| p.to_string_lossy().to_string())
                })
                .unwrap_or_else(|| {
                    std::path::Path::new(path)
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_default()
                });

            json!({
                "path": path,
                "relativePath": relative_path,
                "content": content,
                "session": null
            })
        }
        _ => json!({
            "path": null,
            "relativePath": null,
            "content": null,
            "error": "No file currently open"
        }),
    }
}

async fn handle_get_workspace_path(app_state: &Arc<RwLock<AppState>>) -> Value {
    let state = app_state.read().await;

    match &state.workspace_path {
        Some(path) => json!({ "path": path }),
        None => json!({
            "path": null,
            "error": "No workspace open"
        }),
    }
}
