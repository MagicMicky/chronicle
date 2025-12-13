use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

/// Simple note tracking - just tracks when a note was opened
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteTracker {
    /// Path to the note file
    pub note_path: String,
    /// When the note was opened
    pub opened_at: DateTime<Utc>,
}

impl NoteTracker {
    /// Create a new tracker for a note
    pub fn new(note_path: String) -> Self {
        Self {
            note_path,
            opened_at: Utc::now(),
        }
    }

    /// Get current duration in minutes since file was opened
    pub fn duration_minutes(&self) -> u32 {
        (Utc::now() - self.opened_at).num_minutes().max(0) as u32
    }
}

/// Global tracker manager
pub struct TrackerManager {
    /// Current note tracker (if any)
    current: Mutex<Option<NoteTracker>>,
}

impl TrackerManager {
    pub fn new() -> Self {
        Self {
            current: Mutex::new(None),
        }
    }

    /// Start tracking a note
    pub fn start_tracking(&self, note_path: &str) {
        let mut current = self.current.lock().unwrap();
        *current = Some(NoteTracker::new(note_path.to_string()));
        tracing::debug!("Started tracking {}", note_path);
    }

    /// Stop tracking and return the tracker data (for commit)
    pub fn stop_tracking(&self) -> Option<NoteTracker> {
        let mut current = self.current.lock().unwrap();
        let tracker = current.take();
        if let Some(ref t) = tracker {
            tracing::debug!("Stopped tracking {} ({}m)", t.note_path, t.duration_minutes());
        }
        tracker
    }

    /// Get current tracker info
    pub fn get_info(&self) -> Option<TrackerInfo> {
        let current = self.current.lock().unwrap();
        current.as_ref().map(|t| TrackerInfo {
            note_path: t.note_path.clone(),
            duration_minutes: t.duration_minutes(),
            opened_at: t.opened_at,
        })
    }

    /// Check if currently tracking
    #[allow(dead_code)] // Used in tests
    pub fn is_tracking(&self) -> bool {
        self.current.lock().unwrap().is_some()
    }
}

impl Default for TrackerManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Serializable tracker info for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackerInfo {
    pub note_path: String,
    pub duration_minutes: u32,
    pub opened_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;
    use std::time::Duration;

    #[test]
    fn test_note_tracker() {
        let tracker = NoteTracker::new("test.md".to_string());
        assert_eq!(tracker.duration_minutes(), 0);
    }

    #[test]
    fn test_tracker_manager() {
        let manager = TrackerManager::new();

        // Initially not tracking
        assert!(!manager.is_tracking());
        assert!(manager.get_info().is_none());

        // Start tracking
        manager.start_tracking("test.md");
        assert!(manager.is_tracking());

        let info = manager.get_info().unwrap();
        assert_eq!(info.note_path, "test.md");
        assert_eq!(info.duration_minutes, 0);

        // Stop tracking
        let tracker = manager.stop_tracking().unwrap();
        assert_eq!(tracker.note_path, "test.md");
        assert!(!manager.is_tracking());
    }
}
