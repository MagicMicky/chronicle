use crate::session::{TrackerInfo, TrackerManager};
use crate::storage::{load_metadata, save_metadata, NoteMeta};
use std::path::Path;
use std::sync::Mutex;
use tauri::State;

/// Wrapper for thread-safe tracker manager (Tauri managed state)
pub struct TrackerManagerState(pub Mutex<TrackerManager>);

impl TrackerManagerState {
    pub fn new() -> Self {
        Self(Mutex::new(TrackerManager::new()))
    }
}

impl Default for TrackerManagerState {
    fn default() -> Self {
        Self::new()
    }
}

/// Get current tracker info (duration, path)
#[tauri::command]
pub fn get_tracker_info(tracker_state: State<'_, TrackerManagerState>) -> Result<Option<TrackerInfo>, String> {
    let manager = tracker_state.0.lock()
        .map_err(|e| format!("Failed to acquire tracker lock: {}", e))?;
    Ok(manager.get_info())
}

/// Start tracking a note (called when opening a note)
#[tauri::command]
pub fn start_tracking(note_path: String, tracker_state: State<'_, TrackerManagerState>) -> Result<(), String> {
    let manager = tracker_state.0.lock()
        .map_err(|e| format!("Failed to acquire tracker lock: {}", e))?;
    manager.start_tracking(&note_path);
    Ok(())
}

/// Stop tracking and return duration info (called when closing/switching notes)
/// Returns the tracker data for use in commit
#[tauri::command]
pub fn stop_tracking(tracker_state: State<'_, TrackerManagerState>) -> Result<Option<TrackerInfo>, String> {
    let manager = tracker_state.0.lock()
        .map_err(|e| format!("Failed to acquire tracker lock: {}", e))?;
    let tracker = manager.stop_tracking();
    Ok(tracker.map(|t| {
        let duration = t.duration_minutes();
        TrackerInfo {
            note_path: t.note_path,
            duration_minutes: duration,
            opened_at: t.opened_at,
        }
    }))
}

/// Update metadata with the latest file info
#[tauri::command]
pub fn update_note_metadata(note_path: String) -> Result<(), String> {
    let path = Path::new(&note_path);

    // Load or create metadata
    let mut meta = load_metadata(path)
        .map_err(|e| format!("Failed to load metadata: {}", e))?
        .unwrap_or_else(|| NoteMeta::new(path));

    // Update file timestamp
    meta.update_file();

    // Save
    save_metadata(path, &meta).map_err(|e| format!("Failed to save metadata: {}", e))
}
