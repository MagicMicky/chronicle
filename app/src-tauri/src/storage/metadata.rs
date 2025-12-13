use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use super::StorageError;

/// Session metadata stored in .meta/ JSON files
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMeta {
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub duration_minutes: u32,
    pub annotation_count: u32,
    pub last_annotation_at: Option<DateTime<Utc>>,
}

/// File metadata stored in .meta/ JSON files
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMeta {
    pub name: String,
    pub raw_path: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Full metadata file structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteMeta {
    pub id: String,
    pub version: u32,
    pub file: FileMeta,
    pub session: Option<SessionMeta>,
}

impl NoteMeta {
    /// Create a new metadata entry for a note
    pub fn new(note_path: &Path) -> Self {
        let name = note_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "untitled".to_string());

        let now = Utc::now();
        let id = format!(
            "{}-{}",
            name.trim_end_matches(".md"),
            now.format("%Y%m%d%H%M%S")
        );

        Self {
            id,
            version: 1,
            file: FileMeta {
                name,
                raw_path: None,
                created_at: now,
                updated_at: now,
            },
            session: None,
        }
    }

    /// Update file metadata
    pub fn update_file(&mut self) {
        self.file.updated_at = Utc::now();
    }

    /// Set session metadata
    pub fn set_session(&mut self, session: SessionMeta) {
        self.session = Some(session);
    }
}

/// Get the metadata file path for a note
pub fn get_meta_path(note_path: &Path) -> PathBuf {
    let workspace = note_path.parent().unwrap_or(Path::new("."));
    let filename = note_path
        .file_stem()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "untitled".to_string());

    workspace.join(".meta").join(format!("{}.json", filename))
}

/// Ensure .meta directory exists
pub fn ensure_meta_dir(workspace_path: &Path) -> Result<PathBuf, StorageError> {
    let meta_dir = workspace_path.join(".meta");
    if !meta_dir.exists() {
        std::fs::create_dir_all(&meta_dir).map_err(|e| {
            StorageError::WriteFailed(meta_dir.display().to_string(), e)
        })?;
        tracing::debug!("Created .meta directory at {}", meta_dir.display());
    }
    Ok(meta_dir)
}

/// Load metadata for a note
pub fn load_metadata(note_path: &Path) -> Result<Option<NoteMeta>, StorageError> {
    let meta_path = get_meta_path(note_path);

    if !meta_path.exists() {
        return Ok(None);
    }

    let content = std::fs::read_to_string(&meta_path)
        .map_err(|e| StorageError::ReadFailed(meta_path.display().to_string(), e))?;

    let meta: NoteMeta = serde_json::from_str(&content)
        .map_err(|e| StorageError::ParseError(meta_path.display().to_string(), e.to_string()))?;

    tracing::debug!("Loaded metadata for {}", note_path.display());
    Ok(Some(meta))
}

/// Save metadata for a note
pub fn save_metadata(note_path: &Path, meta: &NoteMeta) -> Result<(), StorageError> {
    let workspace = note_path.parent().unwrap_or(Path::new("."));
    ensure_meta_dir(workspace)?;

    let meta_path = get_meta_path(note_path);

    let content = serde_json::to_string_pretty(meta)
        .map_err(|e| StorageError::SerializeError(e.to_string()))?;

    super::write_file(&meta_path, &content)?;

    tracing::debug!("Saved metadata for {} to {}", note_path.display(), meta_path.display());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_meta_path() {
        let note_path = Path::new("/workspace/2024-12-13-test.md");
        let meta_path = get_meta_path(note_path);
        assert_eq!(meta_path, Path::new("/workspace/.meta/2024-12-13-test.json"));
    }

    #[test]
    fn test_save_load_metadata() {
        let dir = tempdir().unwrap();
        let note_path = dir.path().join("test-note.md");

        // Create test note
        std::fs::write(&note_path, "# Test Note").unwrap();

        let mut meta = NoteMeta::new(&note_path);
        meta.set_session(SessionMeta {
            started_at: Utc::now(),
            ended_at: Some(Utc::now()),
            duration_minutes: 15,
            annotation_count: 2,
            last_annotation_at: Some(Utc::now()),
        });

        // Save
        save_metadata(&note_path, &meta).unwrap();

        // Load
        let loaded = load_metadata(&note_path).unwrap().unwrap();
        assert_eq!(loaded.id, meta.id);
        assert!(loaded.session.is_some());
        assert_eq!(loaded.session.unwrap().duration_minutes, 15);
    }
}
