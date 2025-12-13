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
        .manage(commands::SessionManagerState::new())
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
            // Session commands
            commands::get_session_info,
            commands::start_session_tracking,
            commands::stop_session_tracking,
            commands::record_edit,
            commands::end_session,
            commands::check_session_timeouts,
            commands::update_session_config,
            commands::load_session_metadata,
            commands::save_session_metadata,
            // Git commands
            commands::commit_session,
            commands::commit_annotations,
            commands::commit_manual_snapshot,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
