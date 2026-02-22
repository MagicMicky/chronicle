use crate::commands::chronicle::init_chronicle_dir;
use crate::git;
use crate::models::{FileNode, Workspace, WorkspaceInfo};
use crate::storage;
use crate::watcher::ChronicleWatcher;
use chrono::Utc;
use serde_json::json;
use std::path::Path;
use tauri::Manager;

#[tauri::command]
pub async fn open_workspace(
    app_handle: tauri::AppHandle,
    path: String,
) -> Result<WorkspaceInfo, String> {
    let workspace_path = Path::new(&path);

    // Validate path exists and is directory
    if !workspace_path.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    tracing::info!("Opening workspace");

    // Initialize or open git repo
    let is_git_repo = match git::init_or_open_repo(workspace_path) {
        Ok(_) => true,
        Err(e) => {
            tracing::warn!("Git initialization failed: {}", e);
            false
        }
    };

    // Create .mcp.json for Claude Code integration
    if let Err(e) = create_mcp_config(&app_handle, workspace_path) {
        tracing::warn!("Failed to create .mcp.json: {}", e);
    }

    // Create .claude/settings.json to auto-approve Chronicle MCP tools
    if let Err(e) = create_claude_settings(workspace_path) {
        tracing::warn!("Failed to create .claude/settings.json: {}", e);
    }

    // Initialize .chronicle/ directory structure
    if let Err(e) = init_chronicle_dir(workspace_path) {
        tracing::warn!("Failed to initialize .chronicle/: {}", e);
    }

    // Start filesystem watcher on .chronicle/
    if let Some(watcher) = app_handle.try_state::<ChronicleWatcher>() {
        if let Err(e) = watcher.start(&path, app_handle.clone()) {
            tracing::warn!("Failed to start chronicle watcher: {}", e);
        }
    }

    // List files
    let files = storage::list_files(workspace_path).map_err(|e| e.to_string())?;
    let file_count = storage::count_files(&files);

    // Get workspace name from path
    let name = workspace_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Workspace")
        .to_string();

    // Save to recent workspaces
    let workspace = Workspace {
        path: path.clone(),
        name: name.clone(),
        last_opened: Utc::now(),
    };

    if let Err(e) = storage::save_recent_workspace(&workspace) {
        tracing::warn!("Failed to save recent workspace: {}", e);
    }

    Ok(WorkspaceInfo {
        path,
        name,
        is_git_repo,
        file_count,
    })
}

/// Create .mcp.json in the workspace for Claude Code auto-discovery
fn create_mcp_config(app_handle: &tauri::AppHandle, workspace_path: &Path) -> Result<(), String> {
    // Get the target triple for the current platform
    let target_triple = env!("TAURI_ENV_TARGET_TRIPLE");

    // Get the path to the sidecar binary
    let sidecar_path = if cfg!(debug_assertions) {
        // In dev mode, use the binaries directory in src-tauri
        let manifest_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        manifest_dir.join("binaries").join(format!(
            "chronicle-mcp-{}{}",
            target_triple,
            if cfg!(windows) { ".exe" } else { "" }
        ))
    } else {
        // In release mode, use the bundled resource
        app_handle
            .path()
            .resource_dir()
            .map_err(|e| format!("Failed to get resource dir: {}", e))?
            .join("binaries")
            .join(format!(
                "chronicle-mcp-{}{}",
                target_triple,
                if cfg!(windows) { ".exe" } else { "" }
            ))
    };

    // Verify the binary exists
    if !sidecar_path.exists() {
        return Err(format!(
            "MCP server binary not found at {}. Build it with 'bun run compile' in mcp-server/",
            sidecar_path.display()
        ));
    }

    let sidecar_str = sidecar_path
        .to_str()
        .ok_or("Invalid sidecar path")?
        .to_string();

    // Create MCP config
    let mcp_config = json!({
        "mcpServers": {
            "chronicle": {
                "command": sidecar_str,
                "args": [],
                "env": {}
            }
        }
    });

    let mcp_path = workspace_path.join(".mcp.json");

    // Write the config
    let config_str =
        serde_json::to_string_pretty(&mcp_config).map_err(|e| format!("JSON error: {}", e))?;

    std::fs::write(&mcp_path, config_str).map_err(|e| format!("Failed to write .mcp.json: {}", e))?;

    // Set restrictive file permissions on Unix (0o600 = owner read/write only)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let permissions = std::fs::Permissions::from_mode(0o600);
        std::fs::set_permissions(&mcp_path, permissions)
            .map_err(|e| format!("Failed to set .mcp.json permissions: {}", e))?;
    }

    tracing::info!("Created .mcp.json in workspace");

    Ok(())
}

/// Create .claude/settings.json to auto-approve Chronicle MCP tools
fn create_claude_settings(workspace_path: &Path) -> Result<(), String> {
    let claude_dir = workspace_path.join(".claude");

    // Create .claude directory if it doesn't exist
    if !claude_dir.exists() {
        std::fs::create_dir_all(&claude_dir)
            .map_err(|e| format!("Failed to create .claude directory: {}", e))?;
    }

    let settings_path = claude_dir.join("settings.json");

    // Don't overwrite existing settings
    if settings_path.exists() {
        tracing::debug!(".claude/settings.json already exists, skipping");
        return Ok(());
    }

    // Create settings with auto-approved Chronicle MCP tools
    let settings = json!({
        "permissions": {
            "allow": [
                "mcp__chronicle__process_meeting",
                "mcp__chronicle__get_history",
                "mcp__chronicle__get_version",
                "mcp__chronicle__compare_versions",
                "mcp__chronicle__chronicle_status"
            ]
        }
    });

    let settings_str =
        serde_json::to_string_pretty(&settings).map_err(|e| format!("JSON error: {}", e))?;

    std::fs::write(&settings_path, settings_str)
        .map_err(|e| format!("Failed to write .claude/settings.json: {}", e))?;

    tracing::info!("Created .claude/settings.json at {:?}", settings_path);

    Ok(())
}

#[tauri::command]
pub async fn list_workspace_files(workspace_path: String) -> Result<Vec<FileNode>, String> {
    storage::list_files(Path::new(&workspace_path)).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_recent_workspaces() -> Result<Vec<Workspace>, String> {
    storage::get_recent_workspaces()
        .map(|r| r.workspaces)
        .map_err(|e| e.to_string())
}
