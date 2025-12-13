use crate::models::{FileNode, FileNodeType, RecentWorkspaces, Workspace};
use crate::storage::StorageError;
use chrono::{DateTime, Utc};
use directories::ProjectDirs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

const RECENT_WORKSPACES_FILE: &str = "recent_workspaces.json";
const MAX_RECENT_WORKSPACES: usize = 10;

/// Get the application data directory for Chronicle
pub fn get_app_data_dir() -> Option<PathBuf> {
    ProjectDirs::from("com", "chronicle", "Chronicle").map(|dirs| dirs.data_dir().to_path_buf())
}

/// List all markdown files in a workspace directory
pub fn list_files(workspace_path: &Path) -> Result<Vec<FileNode>, StorageError> {
    if !workspace_path.is_dir() {
        return Err(StorageError::NotFound(
            workspace_path.display().to_string(),
        ));
    }

    let mut root_nodes: Vec<FileNode> = Vec::new();

    for entry in WalkDir::new(workspace_path)
        .min_depth(1)
        .max_depth(1)
        .into_iter()
        .filter_entry(|e| !is_hidden(e))
    {
        let entry = entry.map_err(|e| {
            StorageError::ReadFailed(workspace_path.display().to_string(), e.into_io_error().unwrap_or_else(|| std::io::Error::new(std::io::ErrorKind::Other, "walkdir error")))
        })?;

        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if path.is_dir() {
            // Recursively get children for directories
            let children = list_files_recursive(path)?;
            // Only include directories that have markdown files
            if !children.is_empty() {
                root_nodes.push(FileNode {
                    name,
                    path: path.display().to_string(),
                    node_type: FileNodeType::Directory,
                    children: Some(children),
                    modified_at: get_modified_time(path),
                });
            }
        } else if is_markdown_file(path) {
            root_nodes.push(FileNode {
                name,
                path: path.display().to_string(),
                node_type: FileNodeType::File,
                children: None,
                modified_at: get_modified_time(path),
            });
        }
    }

    // Sort by modification date, newest first
    root_nodes.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));

    Ok(root_nodes)
}

fn list_files_recursive(dir_path: &Path) -> Result<Vec<FileNode>, StorageError> {
    let mut nodes: Vec<FileNode> = Vec::new();

    for entry in WalkDir::new(dir_path)
        .min_depth(1)
        .max_depth(1)
        .into_iter()
        .filter_entry(|e| !is_hidden(e))
    {
        let entry = entry.map_err(|e| {
            StorageError::ReadFailed(dir_path.display().to_string(), e.into_io_error().unwrap_or_else(|| std::io::Error::new(std::io::ErrorKind::Other, "walkdir error")))
        })?;

        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if path.is_dir() {
            let children = list_files_recursive(path)?;
            if !children.is_empty() {
                nodes.push(FileNode {
                    name,
                    path: path.display().to_string(),
                    node_type: FileNodeType::Directory,
                    children: Some(children),
                    modified_at: get_modified_time(path),
                });
            }
        } else if is_markdown_file(path) {
            nodes.push(FileNode {
                name,
                path: path.display().to_string(),
                node_type: FileNodeType::File,
                children: None,
                modified_at: get_modified_time(path),
            });
        }
    }

    nodes.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    Ok(nodes)
}

fn is_hidden(entry: &walkdir::DirEntry) -> bool {
    entry
        .file_name()
        .to_str()
        .map(|s| s.starts_with('.'))
        .unwrap_or(false)
}

fn is_markdown_file(path: &Path) -> bool {
    path.extension()
        .map(|ext| ext.eq_ignore_ascii_case("md"))
        .unwrap_or(false)
}

fn get_modified_time(path: &Path) -> Option<DateTime<Utc>> {
    path.metadata()
        .ok()
        .and_then(|m| m.modified().ok())
        .map(|t| DateTime::<Utc>::from(t))
}

/// Get list of recently opened workspaces
pub fn get_recent_workspaces() -> Result<RecentWorkspaces, StorageError> {
    let Some(data_dir) = get_app_data_dir() else {
        return Ok(RecentWorkspaces::default());
    };

    let path = data_dir.join(RECENT_WORKSPACES_FILE);
    if !path.exists() {
        return Ok(RecentWorkspaces::default());
    }

    let content = crate::storage::read_file(&path)?;
    let recent: RecentWorkspaces = serde_json::from_str(&content)?;
    Ok(recent)
}

/// Save a workspace to the recent list
pub fn save_recent_workspace(workspace: &Workspace) -> Result<(), StorageError> {
    let Some(data_dir) = get_app_data_dir() else {
        return Err(StorageError::InvalidPath(
            "Could not determine app data directory".to_string(),
        ));
    };

    crate::storage::ensure_dir(&data_dir)?;

    let mut recent = get_recent_workspaces().unwrap_or_default();

    // Remove existing entry for this path if present
    recent
        .workspaces
        .retain(|w| w.path != workspace.path);

    // Add new entry at the beginning
    recent.workspaces.insert(0, workspace.clone());

    // Limit the number of recent workspaces
    recent.workspaces.truncate(MAX_RECENT_WORKSPACES);
    recent.version = 1;

    let path = data_dir.join(RECENT_WORKSPACES_FILE);
    let content = serde_json::to_string_pretty(&recent)?;
    crate::storage::write_file(&path, &content)
}

/// Count the number of files in a FileNode tree
pub fn count_files(nodes: &[FileNode]) -> usize {
    nodes.iter().fold(0, |acc, node| {
        if node.node_type == FileNodeType::File {
            acc + 1
        } else {
            acc + node
                .children
                .as_ref()
                .map(|c| count_files(c))
                .unwrap_or(0)
        }
    })
}
