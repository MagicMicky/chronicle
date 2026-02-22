use crate::SharedAppState;
use serde_json::json;
use std::path::Path;
use tauri::State;

/// Count markdown files in a workspace directory
fn count_notes(workspace_path: &str) -> usize {
    let path = Path::new(workspace_path);
    if !path.is_dir() {
        return 0;
    }
    walkdir::WalkDir::new(path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path().extension().is_some_and(|ext| ext == "md")
                && !e
                    .path()
                    .components()
                    .any(|c| c.as_os_str().to_string_lossy().starts_with('.'))
        })
        .count()
}

/// Write state.json to the .chronicle/ directory
fn write_state_json(workspace_path: &str, file_path: Option<&str>) {
    let state_path = Path::new(workspace_path).join(".chronicle/state.json");
    if !state_path.parent().is_some_and(|p| p.exists()) {
        return;
    }

    let state = json!({
        "workspacePath": workspace_path,
        "currentFile": file_path,
        "lastEdited": chrono::Utc::now().to_rfc3339(),
        "noteCount": count_notes(workspace_path),
    });

    if let Err(e) = std::fs::write(&state_path, serde_json::to_string_pretty(&state).unwrap_or_default()) {
        tracing::warn!("Failed to write state.json: {}", e);
    }
}

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

    if let Some(ref path) = file_path {
        app_state.current_file_path = Some(path.clone());
    }

    if let Some(content) = file_content {
        app_state.current_file_content = Some(content);
    }

    if let Some(ref path) = workspace_path {
        app_state.workspace_path = Some(path.clone());
    }

    // Write state.json to .chronicle/ if we have a workspace path
    let ws = app_state.workspace_path.clone();
    let fp = app_state.current_file_path.clone();
    if let Some(ref ws_path) = ws {
        write_state_json(ws_path, fp.as_deref());
    }

    tracing::debug!(
        "App state updated: file_set={}, workspace_set={}",
        app_state.current_file_path.is_some(),
        app_state.workspace_path.is_some()
    );

    Ok(())
}

/// Check if Claude Code CLI is available (replaces old MCP WebSocket status)
#[tauri::command]
pub async fn get_mcp_status(_state: State<'_, SharedAppState>) -> Result<bool, String> {
    // In the new architecture, we check if claude CLI is available
    // rather than WebSocket connection status
    match tokio::process::Command::new("claude")
        .args(["--version"])
        .output()
        .await
    {
        Ok(o) => Ok(o.status.success()),
        Err(_) => Ok(false),
    }
}
