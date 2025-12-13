mod commands;
mod git;
mod models;
mod storage;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    tracing_subscriber::fmt::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::open_workspace,
            commands::list_workspace_files,
            commands::get_recent_workspaces,
            commands::read_file,
            commands::write_file,
            commands::file_exists,
            commands::suggest_rename,
            commands::rename_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
