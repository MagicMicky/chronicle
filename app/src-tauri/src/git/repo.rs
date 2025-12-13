use git2::{Repository, Signature};
use std::path::Path;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum GitError {
    #[error("Git operation failed: {0}")]
    Git(#[from] git2::Error),

    #[error("Storage error: {0}")]
    Storage(#[from] crate::storage::StorageError),
}

const DEFAULT_GITIGNORE: &str = r#"# Chronicle app state (not content)
.chronicle/state.json

# OS files
.DS_Store
Thumbs.db

# Editor backups
*~
*.swp
*.swo

# Temporary files
*.tmp
*.temp
"#;

/// Check if a path is a git repository
pub fn is_git_repo(path: &Path) -> bool {
    path.join(".git").exists()
}

/// Initialize a new git repository or open an existing one
pub fn init_or_open_repo(workspace_path: &Path) -> Result<Repository, GitError> {
    if is_git_repo(workspace_path) {
        tracing::info!("Opening existing git repository at {}", workspace_path.display());
        Repository::open(workspace_path).map_err(GitError::Git)
    } else {
        tracing::info!("Initializing new git repository at {}", workspace_path.display());
        let repo = Repository::init(workspace_path)?;

        // Create default .gitignore
        let gitignore_path = create_default_gitignore(workspace_path)?;

        // Create initial commit
        create_initial_commit(&repo, &gitignore_path)?;

        Ok(repo)
    }
}

/// Create a default .gitignore file for Chronicle workspaces
fn create_default_gitignore(workspace_path: &Path) -> Result<std::path::PathBuf, crate::storage::StorageError> {
    let gitignore_path = workspace_path.join(".gitignore");
    if !gitignore_path.exists() {
        crate::storage::write_file(&gitignore_path, DEFAULT_GITIGNORE)?;
        tracing::debug!("Created .gitignore at {}", gitignore_path.display());
    }
    Ok(gitignore_path)
}

/// Create the initial commit with .gitignore
fn create_initial_commit(repo: &Repository, gitignore_path: &Path) -> Result<(), GitError> {
    let mut index = repo.index()?;

    // Add .gitignore to index
    let relative_path = gitignore_path.file_name().unwrap_or_default();
    index.add_path(Path::new(relative_path))?;
    index.write()?;

    let tree_id = index.write_tree()?;
    let tree = repo.find_tree(tree_id)?;

    let sig = Signature::now("Chronicle", "chronicle@localhost")?;

    repo.commit(
        Some("HEAD"),
        &sig,
        &sig,
        "Initial commit: Chronicle workspace",
        &tree,
        &[], // No parents for initial commit
    )?;

    tracing::info!("Created initial commit");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_init_new_repo() {
        let dir = tempdir().unwrap();
        let repo = init_or_open_repo(dir.path()).unwrap();

        assert!(is_git_repo(dir.path()));
        assert!(dir.path().join(".gitignore").exists());

        // Verify we can get the HEAD commit
        let head = repo.head().unwrap();
        assert!(head.is_branch());
    }

    #[test]
    fn test_open_existing_repo() {
        let dir = tempdir().unwrap();

        // Init first time
        init_or_open_repo(dir.path()).unwrap();

        // Open second time should succeed
        let repo = init_or_open_repo(dir.path()).unwrap();
        assert!(repo.head().is_ok());
    }
}
