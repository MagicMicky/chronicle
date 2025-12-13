use crate::git::{commit_files, CommitType};
use crate::storage::get_meta_path;
use std::path::Path;

/// Commit a note to git (on file close/switch)
#[tauri::command]
pub fn commit_session(
    workspace_path: String,
    note_path: String,
    title: String,
    duration_minutes: u32,
) -> Result<String, String> {
    let workspace = Path::new(&workspace_path);
    let note = Path::new(&note_path);

    // Get relative paths for the note and its metadata
    let note_relative = note.strip_prefix(workspace).unwrap_or(note);

    let meta_path = get_meta_path(note);
    let meta_relative = meta_path.strip_prefix(workspace).unwrap_or(&meta_path);

    // Format duration
    let duration_str = format!("{}m", duration_minutes);

    // Commit the note and metadata files
    let commit_id = commit_files(
        workspace,
        &[note_relative, meta_relative],
        CommitType::Session,
        &title,
        &duration_str,
    )
    .map_err(|e| format!("Git commit failed: {}", e))?;

    Ok(commit_id)
}

/// Create a manual snapshot commit
#[tauri::command]
pub fn commit_manual_snapshot(workspace_path: String, title: String) -> Result<String, String> {
    let workspace = Path::new(&workspace_path);

    crate::git::commit_snapshot(workspace, &title)
        .map_err(|e| format!("Snapshot commit failed: {}", e))
}
