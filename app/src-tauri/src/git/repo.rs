use git2::{Repository, Signature, StatusOptions};
use std::path::Path;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum GitError {
    #[error("Git operation failed: {0}")]
    Git(#[from] git2::Error),

    #[error("Storage error: {0}")]
    Storage(#[from] crate::storage::StorageError),

    #[error("Repository not found at {0}")]
    RepoNotFound(String),
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

/// Commit type for semantic commits
#[derive(Debug, Clone, Copy)]
#[allow(dead_code)] // Process, Annotate, Snapshot used in future milestones
pub enum CommitType {
    Session,
    Process,
    Annotate,
    Snapshot,
}

impl CommitType {
    pub fn prefix(&self) -> &'static str {
        match self {
            CommitType::Session => "session",
            CommitType::Process => "process",
            CommitType::Annotate => "annotate",
            CommitType::Snapshot => "snapshot",
        }
    }
}

/// Stage specific files and create a commit
pub fn commit_files(
    workspace_path: &Path,
    files: &[&Path],
    commit_type: CommitType,
    title: &str,
    detail: &str,
) -> Result<String, GitError> {
    if !is_git_repo(workspace_path) {
        return Err(GitError::RepoNotFound(workspace_path.display().to_string()));
    }

    let repo = Repository::open(workspace_path)?;
    let mut index = repo.index()?;

    // Stage the specified files
    for file_path in files {
        // Get path relative to workspace
        let relative_path = if file_path.starts_with(workspace_path) {
            file_path.strip_prefix(workspace_path).unwrap()
        } else {
            *file_path
        };

        // Only add if file exists
        let full_path = workspace_path.join(relative_path);
        if full_path.exists() {
            index.add_path(relative_path)?;
            tracing::debug!("Staged: {}", relative_path.display());
        }
    }

    index.write()?;

    // Check if there's anything to commit
    let tree_id = index.write_tree()?;
    let tree = repo.find_tree(tree_id)?;

    // Get parent commit
    let parent = match repo.head() {
        Ok(head) => Some(head.peel_to_commit()?),
        Err(_) => None,
    };

    // Build commit message
    let message = format!("{}: {} ({})", commit_type.prefix(), title, detail);

    let sig = Signature::now("Chronicle", "chronicle@localhost")?;

    let commit_id = if let Some(parent) = parent {
        repo.commit(Some("HEAD"), &sig, &sig, &message, &tree, &[&parent])?
    } else {
        repo.commit(Some("HEAD"), &sig, &sig, &message, &tree, &[])?
    };

    let short_id = commit_id.to_string()[..7].to_string();
    tracing::info!("Created commit {}: {}", short_id, message);

    Ok(short_id)
}

/// Stage all changes and create a snapshot commit
pub fn commit_snapshot(workspace_path: &Path, title: &str) -> Result<String, GitError> {
    if !is_git_repo(workspace_path) {
        return Err(GitError::RepoNotFound(workspace_path.display().to_string()));
    }

    let repo = Repository::open(workspace_path)?;
    let mut index = repo.index()?;

    // Add all changes
    index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)?;
    index.write()?;

    let tree_id = index.write_tree()?;
    let tree = repo.find_tree(tree_id)?;

    let parent = repo.head()?.peel_to_commit()?;

    let message = format!("snapshot: {}", title);
    let sig = Signature::now("Chronicle", "chronicle@localhost")?;

    let commit_id = repo.commit(Some("HEAD"), &sig, &sig, &message, &tree, &[&parent])?;

    let short_id = commit_id.to_string()[..7].to_string();
    tracing::info!("Created snapshot commit {}: {}", short_id, message);

    Ok(short_id)
}

/// Check if there are uncommitted changes
#[allow(dead_code)] // Will be used for dirty checking in future
pub fn has_changes(workspace_path: &Path) -> Result<bool, GitError> {
    if !is_git_repo(workspace_path) {
        return Ok(false);
    }

    let repo = Repository::open(workspace_path)?;
    let mut opts = StatusOptions::new();
    opts.include_untracked(true);

    let statuses = repo.statuses(Some(&mut opts))?;
    Ok(!statuses.is_empty())
}

/// Get list of modified/untracked files (not yet committed)
pub fn get_uncommitted_files(workspace_path: &Path) -> Result<Vec<String>, GitError> {
    if !is_git_repo(workspace_path) {
        return Ok(vec![]);
    }

    let repo = Repository::open(workspace_path)?;
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true);

    let statuses = repo.statuses(Some(&mut opts))?;
    let mut files = Vec::new();

    for entry in statuses.iter() {
        if let Some(path) = entry.path() {
            // Include modified, new, deleted files
            let status = entry.status();
            if status.is_index_new()
                || status.is_index_modified()
                || status.is_index_deleted()
                || status.is_wt_new()
                || status.is_wt_modified()
                || status.is_wt_deleted()
            {
                // Return full path
                let full_path = workspace_path.join(path);
                files.push(full_path.to_string_lossy().to_string());
            }
        }
    }

    Ok(files)
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

    #[test]
    fn test_commit_files() {
        let dir = tempdir().unwrap();
        init_or_open_repo(dir.path()).unwrap();

        // Create a test file
        let note_path = dir.path().join("test-note.md");
        std::fs::write(&note_path, "# Test Note\n\nSome content").unwrap();

        // Commit it
        let commit_id = commit_files(
            dir.path(),
            &[Path::new("test-note.md")],
            CommitType::Session,
            "Test Note",
            "5m",
        )
        .unwrap();

        assert_eq!(commit_id.len(), 7);
    }
}
