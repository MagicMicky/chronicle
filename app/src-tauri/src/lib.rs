mod commands;
mod git;
mod models;
mod session;
mod storage;
mod watcher;

use std::sync::Arc;
use tokio::sync::RwLock;

/// Shared application state for tracking current file and workspace
#[derive(Default)]
pub struct AppState {
    pub current_file_path: Option<String>,
    pub current_file_content: Option<String>,
    pub workspace_path: Option<String>,
}

pub type SharedAppState = Arc<RwLock<AppState>>;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    tracing_subscriber::fmt::init();

    // Create shared app state
    let app_state: SharedAppState = Arc::new(RwLock::new(AppState::default()));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_pty::init())
        .manage(commands::TrackerManagerState::new())
        .manage(app_state.clone())
        .manage(watcher::ChronicleWatcher::new())
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
            commands::delete_file,
            commands::create_folder,
            // Tracking commands (simplified)
            commands::get_tracker_info,
            commands::start_tracking,
            commands::stop_tracking,
            commands::update_note_metadata,
            // Git commands
            commands::commit_session,
            commands::commit_manual_snapshot,
            commands::get_git_status,
            // App state commands
            commands::update_app_state,
            commands::get_mcp_status,
            // Search commands
            commands::search_notes,
            // Claude commands
            commands::run_claude_task,
            commands::process_note,
            commands::run_agent,
            commands::run_background_agents,
            commands::check_claude_installed,
            // Chronicle index commands
            commands::start_chronicle_watcher,
            commands::read_tags,
            commands::read_actions,
            commands::read_links,
            commands::read_processed,
            commands::get_agent_status,
            // Template commands
            commands::list_templates,
            commands::create_from_template,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
