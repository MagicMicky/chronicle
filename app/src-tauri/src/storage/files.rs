use std::fs;
use std::path::Path;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum StorageError {
    #[error("Failed to read file {0}: {1}")]
    ReadFailed(String, #[source] std::io::Error),

    #[error("Failed to write file {0}: {1}")]
    WriteFailed(String, #[source] std::io::Error),

    #[error("Path not found: {0}")]
    NotFound(String),

    #[error("Invalid path: {0}")]
    InvalidPath(String),

    #[error("JSON error: {0}")]
    JsonError(#[from] serde_json::Error),
}

pub fn read_file(path: &Path) -> Result<String, StorageError> {
    fs::read_to_string(path).map_err(|e| StorageError::ReadFailed(path.display().to_string(), e))
}

pub fn write_file(path: &Path, content: &str) -> Result<(), StorageError> {
    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| StorageError::WriteFailed(parent.display().to_string(), e))?;
    }

    fs::write(path, content).map_err(|e| StorageError::WriteFailed(path.display().to_string(), e))
}

pub fn write_file_atomic(path: &Path, content: &str) -> Result<(), StorageError> {
    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| StorageError::WriteFailed(parent.display().to_string(), e))?;
    }

    // Write to temp file first, then rename for atomic operation
    let temp_path = path.with_extension("tmp");
    fs::write(&temp_path, content)
        .map_err(|e| StorageError::WriteFailed(temp_path.display().to_string(), e))?;

    fs::rename(&temp_path, path)
        .map_err(|e| StorageError::WriteFailed(path.display().to_string(), e))
}

pub fn file_exists(path: &Path) -> bool {
    path.exists()
}

pub fn ensure_dir(path: &Path) -> Result<(), StorageError> {
    fs::create_dir_all(path).map_err(|e| StorageError::WriteFailed(path.display().to_string(), e))
}
