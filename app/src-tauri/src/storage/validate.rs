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

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_valid_path_within_workspace() {
        let dir = tempdir().unwrap();
        let workspace = dir.path();
        let file = workspace.join("test.md");
        std::fs::write(&file, "content").unwrap();
        assert!(validate_workspace_path(workspace, &file).is_ok());
    }

    #[test]
    fn test_traversal_rejected() {
        let dir = tempdir().unwrap();
        let workspace = dir.path();
        let bad_path = workspace.join("../../etc/passwd");
        assert!(validate_workspace_path(workspace, &bad_path).is_err());
    }

    #[test]
    fn test_relative_path_within_workspace() {
        let dir = tempdir().unwrap();
        let workspace = dir.path();
        std::fs::write(workspace.join("note.md"), "hi").unwrap();
        let result = validate_workspace_path(workspace, Path::new("note.md"));
        assert!(result.is_ok());
    }

    #[test]
    fn test_new_file_in_workspace() {
        let dir = tempdir().unwrap();
        let workspace = dir.path();
        // File doesn't exist yet but parent (workspace) does
        let new_file = workspace.join("new-note.md");
        let result = validate_workspace_path(workspace, &new_file);
        assert!(result.is_ok());
    }

    #[test]
    fn test_absolute_path_outside_workspace_rejected() {
        let dir = tempdir().unwrap();
        let workspace = dir.path();
        let outside = Path::new("/tmp/evil.md");
        let result = validate_workspace_path(workspace, outside);
        assert!(result.is_err());
    }

    #[test]
    fn test_subdirectory_path_accepted() {
        let dir = tempdir().unwrap();
        let workspace = dir.path();
        let subdir = workspace.join("notes");
        std::fs::create_dir(&subdir).unwrap();
        let file = subdir.join("meeting.md");
        std::fs::write(&file, "content").unwrap();
        let result = validate_workspace_path(workspace, &file);
        assert!(result.is_ok());
    }
}
