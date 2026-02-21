use crate::{SharedAppState, WsBroadcastState};
use tauri::State;

/// Trigger AI processing of the current note via the MCP server.
/// Sends a WebSocket request to connected MCP clients to process the current file.
#[tauri::command]
pub async fn trigger_processing(
    app_state: State<'_, SharedAppState>,
    ws_broadcast: State<'_, WsBroadcastState>,
    style: Option<String>,
) -> Result<(), String> {
    // Validate that a file is currently open
    let state = app_state.read().await;
    if state.current_file_path.is_none() {
        return Err("No file currently open. Open a note first.".to_string());
    }
    drop(state);

    let processing_style = style.unwrap_or_else(|| "standard".to_string());

    // Build the request message for the MCP server
    let request_id = format!("trigger-{}", uuid_v4());
    let message = serde_json::json!({
        "type": "request",
        "id": request_id,
        "method": "triggerProcessing",
        "data": {
            "style": processing_style
        }
    });

    let msg_str = serde_json::to_string(&message)
        .map_err(|e| format!("Failed to serialize processing request: {}", e))?;

    // Broadcast to all connected WebSocket clients (MCP server)
    ws_broadcast.0.send(msg_str).map_err(|e| {
        format!(
            "Failed to send processing request. Is the MCP server connected? Error: {}",
            e
        )
    })?;

    tracing::info!(
        "Triggered processing with style '{}' (request: {})",
        processing_style,
        request_id
    );

    Ok(())
}

/// Generate a simple UUID v4 (random) without external dependency
fn uuid_v4() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let nanos = now.as_nanos();
    let random_part: u64 = (nanos as u64) ^ (nanos.wrapping_shr(64) as u64);
    format!("{:016x}-{:04x}", random_part, std::process::id() & 0xFFFF)
}
