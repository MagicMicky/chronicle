use crate::session::{Session, SessionConfig, SessionInfo, SessionManager, SessionState};
use crate::storage::{load_metadata, save_metadata, NoteMeta, SessionMeta};
use std::path::Path;
use std::sync::Mutex;
use tauri::State;

/// Wrapper for thread-safe session manager
pub struct SessionState(pub Mutex<SessionManager>);

impl SessionState {
    pub fn new() -> Self {
        Self(Mutex::new(SessionManager::new(SessionConfig::default())))
    }
}

impl Default for SessionState {
    fn default() -> Self {
        Self::new()
    }
}

/// Get current session info
#[tauri::command]
pub fn get_session_info(session_state: State<'_, SessionState>) -> Option<SessionInfo> {
    let manager = session_state.0.lock().unwrap();
    manager.get_session_info()
}

/// Start tracking a note (called when opening a note)
#[tauri::command]
pub fn start_session_tracking(
    note_path: String,
    existing_session: Option<Session>,
    session_state: State<'_, SessionState>,
) {
    let manager = session_state.0.lock().unwrap();
    manager.open_note(&note_path, existing_session);
    tracing::debug!("Started tracking session for {}", note_path);
}

/// Stop tracking (called when closing a note)
#[tauri::command]
pub fn stop_session_tracking(session_state: State<'_, SessionState>) -> Option<Session> {
    let manager = session_state.0.lock().unwrap();
    manager.close_note()
}

/// Record an edit to the current note
#[tauri::command]
pub fn record_edit(session_state: State<'_, SessionState>) {
    let manager = session_state.0.lock().unwrap();
    manager.record_edit();
}

/// Manually end the current session
#[tauri::command]
pub fn end_session(session_state: State<'_, SessionState>) -> Option<Session> {
    let manager = session_state.0.lock().unwrap();
    manager.end_session()
}

/// Check for timeouts (called periodically from frontend)
#[tauri::command]
pub fn check_session_timeouts(session_state: State<'_, SessionState>) -> Option<Session> {
    let manager = session_state.0.lock().unwrap();
    manager.check_timeouts()
}

/// Update session configuration
#[tauri::command]
pub fn update_session_config(
    inactivity_timeout_minutes: u32,
    max_duration_minutes: u32,
    session_state: State<'_, SessionState>,
) {
    let mut manager = session_state.0.lock().unwrap();
    *manager = SessionManager::new(SessionConfig {
        inactivity_timeout_minutes,
        max_duration_minutes,
    });
    tracing::info!(
        "Session config updated: inactivity={}m, max={}m",
        inactivity_timeout_minutes,
        max_duration_minutes
    );
}

/// Load session metadata for a note file
#[tauri::command]
pub fn load_session_metadata(note_path: String) -> Result<Option<Session>, String> {
    let path = Path::new(&note_path);

    let meta = load_metadata(path)
        .map_err(|e| format!("Failed to load metadata: {}", e))?;

    match meta {
        Some(m) => {
            if let Some(session_meta) = m.session {
                // Convert metadata to Session
                let session = Session::from_ended(
                    note_path,
                    session_meta.started_at,
                    session_meta.ended_at.unwrap_or(session_meta.started_at),
                    session_meta.duration_minutes,
                    session_meta.annotation_count,
                    session_meta.last_annotation_at,
                );
                Ok(Some(session))
            } else {
                Ok(None)
            }
        }
        None => Ok(None),
    }
}

/// Save session metadata for a note file
#[tauri::command]
pub fn save_session_metadata(note_path: String, session: Session) -> Result<(), String> {
    let path = Path::new(&note_path);

    // Load or create metadata
    let mut meta = load_metadata(path)
        .map_err(|e| format!("Failed to load metadata: {}", e))?
        .unwrap_or_else(|| NoteMeta::new(path));

    // Update session metadata
    if let (Some(started), Some(ended)) = (session.started_at, session.ended_at) {
        meta.set_session(SessionMeta {
            started_at: started,
            ended_at: Some(ended),
            duration_minutes: session.duration_minutes,
            annotation_count: session.annotation_count,
            last_annotation_at: session.last_annotation_at,
        });
    }

    // Update file timestamp
    meta.update_file();

    // Save
    save_metadata(path, &meta)
        .map_err(|e| format!("Failed to save metadata: {}", e))
}
