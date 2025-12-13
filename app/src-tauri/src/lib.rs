mod commands;
mod git;
mod models;
mod session;
mod storage;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    tracing_subscriber::fmt::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_pty::init())
        .manage(commands::TrackerManagerState::new())
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
            // Tracking commands (simplified)
            commands::get_tracker_info,
            commands::start_tracking,
            commands::stop_tracking,
            commands::update_note_metadata,
            // Git commands
            commands::commit_session,
            commands::commit_manual_snapshot,
            commands::get_git_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
