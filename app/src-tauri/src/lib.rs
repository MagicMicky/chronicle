mod commands;
mod git;
mod models;
mod session;
mod storage;
mod websocket;

use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};

pub use websocket::{AppState, SharedAppState};

/// Global broadcast sender for WebSocket messages
pub struct WsBroadcastState(pub broadcast::Sender<String>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    tracing_subscriber::fmt::init();

    // Create shared app state for WebSocket handlers
    let app_state: SharedAppState = Arc::new(RwLock::new(AppState::default()));

    // Start WebSocket server on port 9847
    let ws_broadcast = websocket::start_ws_server(9847, app_state.clone());
    tracing::info!("WebSocket server starting on port 9847");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_pty::init())
        .manage(commands::TrackerManagerState::new())
        .manage(app_state.clone())
        .manage(WsBroadcastState(ws_broadcast))
        .setup(move |app| {
            // Store app handle in shared state for WebSocket event emission
            let app_handle = app.handle().clone();
            let state_clone = app_state.clone();
            tauri::async_runtime::spawn(async move {
                let mut state = state_clone.write().await;
                state.app_handle = Some(app_handle);
                tracing::info!("App handle stored in WebSocket app state");
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Workspace commands
            commands::open_workspace,
            commands::list_workspace_files,
            commands::get_recent_workspaces,
            // File commands
            commands::read_file,
            commands::write_file,
            commands::file_exists,
            commands::suggest_rename,
            commands::rename_file,
            commands::generate_note_path,
            commands::get_default_shell,
            commands::read_processed_file,
            // Tracking commands (simplified)
            commands::get_tracker_info,
            commands::start_tracking,
            commands::stop_tracking,
            commands::update_note_metadata,
            // Git commands
            commands::commit_session,
            commands::commit_manual_snapshot,
            commands::get_git_status,
            // App state commands (for WebSocket)
            commands::update_app_state,
            commands::get_ws_port,
            commands::get_processing_result,
            // Processing commands
            commands::trigger_processing,
            commands::get_mcp_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
