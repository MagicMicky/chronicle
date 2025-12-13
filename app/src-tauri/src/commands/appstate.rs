use crate::SharedAppState;
use serde::Serialize;
use tauri::State;

/// Update the app state with current file and workspace information
/// Called by the frontend when the current file or workspace changes
#[tauri::command]
pub async fn update_app_state(
    state: State<'_, SharedAppState>,
    file_path: Option<String>,
    file_content: Option<String>,
    workspace_path: Option<String>,
) -> Result<(), String> {
    let mut app_state = state.write().await;

    if let Some(path) = file_path {
        app_state.current_file_path = Some(path);
    }

    if let Some(content) = file_content {
        app_state.current_file_content = Some(content);
    }

    if let Some(path) = workspace_path {
        app_state.workspace_path = Some(path);
    }

    tracing::debug!(
        "App state updated: file={:?}, workspace={:?}",
        app_state.current_file_path,
        app_state.workspace_path
    );

    Ok(())
}

/// Get the WebSocket server port
#[tauri::command]
pub fn get_ws_port() -> u16 {
    9847
}

#[derive(Serialize)]
pub struct ProcessingResult {
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
}

/// Get the last processing result from MCP server
/// Clears the result after reading
#[tauri::command]
pub async fn get_processing_result(state: State<'_, SharedAppState>) -> Result<ProcessingResult, String> {
    let mut app_state = state.write().await;

    let result = ProcessingResult {
        result: app_state.last_processing_result.take(),
        error: app_state.last_processing_error.take(),
    };

    Ok(result)
}
