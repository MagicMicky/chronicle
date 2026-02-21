use std::path::{Path, PathBuf};

/// Validates that a target path is within the workspace boundary.
/// Prevents path traversal attacks (../ escaping workspace).
pub fn validate_workspace_path(workspace: &Path, target: &Path) -> Result<PathBuf, String> {
    let canonical_workspace = workspace.canonicalize()
        .map_err(|e| format!("Invalid workspace path: {}", e))?;

    let resolved = if target.is_absolute() {
        target.to_path_buf()
    } else {
        workspace.join(target)
    };

    // For existing files, canonicalize fully
    // For new files, canonicalize parent directory
    let canonical_target = if resolved.exists() {
        resolved.canonicalize()
            .map_err(|e| format!("Invalid target path: {}", e))?
    } else {
        let parent = resolved.parent()
            .ok_or("Invalid path: no parent directory")?;
        let parent_canonical = parent.canonicalize()
            .map_err(|e| format!("Invalid parent path: {}", e))?;
        let filename = resolved.file_name()
            .ok_or("Invalid path: no filename")?;
        parent_canonical.join(filename)
    };

    if !canonical_target.starts_with(&canonical_workspace) {
        return Err("Path is outside workspace boundary".to_string());
    }

    Ok(canonical_target)
}
