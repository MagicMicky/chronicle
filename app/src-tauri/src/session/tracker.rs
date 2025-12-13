use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

/// Session state
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SessionState {
    /// No active session
    Inactive,
    /// Session in progress
    Active,
    /// Session ended (edits are now annotations)
    Ended,
}

impl Default for SessionState {
    fn default() -> Self {
        Self::Inactive
    }
}

/// Session configuration
#[derive(Debug, Clone, Copy)]
pub struct SessionConfig {
    /// Inactivity timeout in minutes
    pub inactivity_timeout_minutes: u32,
    /// Maximum session duration in minutes
    pub max_duration_minutes: u32,
}

impl Default for SessionConfig {
    fn default() -> Self {
        Self {
            inactivity_timeout_minutes: 15,
            max_duration_minutes: 120,
        }
    }
}

/// Session data for a note
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    /// Path to the note file
    pub note_path: String,
    /// Current state
    pub state: SessionState,
    /// When the session started
    pub started_at: Option<DateTime<Utc>>,
    /// When the session ended
    pub ended_at: Option<DateTime<Utc>>,
    /// When the last edit occurred
    pub last_edit_at: Option<DateTime<Utc>>,
    /// Duration in minutes when session ended
    pub duration_minutes: u32,
    /// Number of annotations (edits after session ended)
    pub annotation_count: u32,
    /// When the last annotation occurred
    pub last_annotation_at: Option<DateTime<Utc>>,
}

impl Session {
    /// Create a new inactive session for a note
    pub fn new(note_path: String) -> Self {
        Self {
            note_path,
            state: SessionState::Inactive,
            started_at: None,
            ended_at: None,
            last_edit_at: None,
            duration_minutes: 0,
            annotation_count: 0,
            last_annotation_at: None,
        }
    }

    /// Create a session that's already ended (loaded from metadata)
    pub fn from_ended(
        note_path: String,
        started_at: DateTime<Utc>,
        ended_at: DateTime<Utc>,
        duration_minutes: u32,
        annotation_count: u32,
        last_annotation_at: Option<DateTime<Utc>>,
    ) -> Self {
        Self {
            note_path,
            state: SessionState::Ended,
            started_at: Some(started_at),
            ended_at: Some(ended_at),
            last_edit_at: Some(ended_at),
            duration_minutes,
            annotation_count,
            last_annotation_at,
        }
    }

    /// Start a new session
    pub fn start(&mut self) {
        let now = Utc::now();
        self.state = SessionState::Active;
        self.started_at = Some(now);
        self.last_edit_at = Some(now);
        self.ended_at = None;
        self.duration_minutes = 0;
        self.annotation_count = 0;
        self.last_annotation_at = None;
        tracing::info!("Session started for {}", self.note_path);
    }

    /// Record an edit
    pub fn record_edit(&mut self) {
        let now = Utc::now();

        match self.state {
            SessionState::Inactive => {
                // First edit starts the session
                self.start();
            }
            SessionState::Active => {
                // Update last edit time
                self.last_edit_at = Some(now);
            }
            SessionState::Ended => {
                // This is an annotation
                self.annotation_count += 1;
                self.last_annotation_at = Some(now);
                tracing::debug!(
                    "Annotation #{} for {}",
                    self.annotation_count,
                    self.note_path
                );
            }
        }
    }

    /// End the session
    pub fn end(&mut self) {
        if self.state != SessionState::Active {
            return;
        }

        let now = Utc::now();
        self.state = SessionState::Ended;
        self.ended_at = Some(now);

        // Calculate final duration
        if let Some(started) = self.started_at {
            self.duration_minutes = (now - started).num_minutes().max(0) as u32;
        }

        tracing::info!(
            "Session ended for {} ({}m)",
            self.note_path,
            self.duration_minutes
        );
    }

    /// Check if session should end due to inactivity or max duration
    pub fn check_timeouts(&mut self, config: &SessionConfig) -> bool {
        if self.state != SessionState::Active {
            return false;
        }

        let now = Utc::now();

        // Check max duration
        if let Some(started) = self.started_at {
            let duration = now - started;
            if duration >= Duration::minutes(config.max_duration_minutes as i64) {
                tracing::info!("Session ended due to max duration");
                self.end();
                return true;
            }
        }

        // Check inactivity
        if let Some(last_edit) = self.last_edit_at {
            let inactive = now - last_edit;
            if inactive >= Duration::minutes(config.inactivity_timeout_minutes as i64) {
                tracing::info!("Session ended due to inactivity");
                self.end();
                return true;
            }
        }

        false
    }

    /// Get current duration in minutes (for active sessions)
    pub fn current_duration_minutes(&self) -> u32 {
        match self.state {
            SessionState::Active => {
                if let Some(started) = self.started_at {
                    (Utc::now() - started).num_minutes().max(0) as u32
                } else {
                    0
                }
            }
            SessionState::Ended => self.duration_minutes,
            SessionState::Inactive => 0,
        }
    }

    /// Check if session is active
    pub fn is_active(&self) -> bool {
        self.state == SessionState::Active
    }

    /// Check if session has ended
    pub fn has_ended(&self) -> bool {
        self.state == SessionState::Ended
    }
}

/// Global session manager
pub struct SessionManager {
    /// Current session (if any)
    current: Mutex<Option<Session>>,
    /// Configuration
    config: SessionConfig,
}

impl SessionManager {
    pub fn new(config: SessionConfig) -> Self {
        Self {
            current: Mutex::new(None),
            config,
        }
    }

    /// Get current session state
    pub fn get_session(&self) -> Option<Session> {
        self.current.lock().unwrap().clone()
    }

    /// Start or resume a session for a note
    pub fn open_note(&self, note_path: &str, existing_session: Option<Session>) {
        let mut current = self.current.lock().unwrap();

        // If there's an existing session from metadata, use it
        if let Some(session) = existing_session {
            *current = Some(session);
        } else {
            // Create new inactive session
            *current = Some(Session::new(note_path.to_string()));
        }
    }

    /// Close the current note (ends session if active)
    pub fn close_note(&self) -> Option<Session> {
        let mut current = self.current.lock().unwrap();
        if let Some(session) = current.as_mut() {
            if session.is_active() {
                session.end();
            }
        }
        current.take()
    }

    /// Record an edit to the current note
    pub fn record_edit(&self) {
        let mut current = self.current.lock().unwrap();
        if let Some(session) = current.as_mut() {
            session.record_edit();
        }
    }

    /// End the current session
    pub fn end_session(&self) -> Option<Session> {
        let mut current = self.current.lock().unwrap();
        if let Some(session) = current.as_mut() {
            session.end();
        }
        current.clone()
    }

    /// Check timeouts and return session if it ended
    pub fn check_timeouts(&self) -> Option<Session> {
        let mut current = self.current.lock().unwrap();
        if let Some(session) = current.as_mut() {
            if session.check_timeouts(&self.config) {
                return Some(session.clone());
            }
        }
        None
    }

    /// Get session info for display
    pub fn get_session_info(&self) -> Option<SessionInfo> {
        let current = self.current.lock().unwrap();
        current.as_ref().map(|s| SessionInfo {
            note_path: s.note_path.clone(),
            state: s.state,
            duration_minutes: s.current_duration_minutes(),
            annotation_count: s.annotation_count,
            started_at: s.started_at,
            ended_at: s.ended_at,
        })
    }
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new(SessionConfig::default())
    }
}

/// Serializable session info for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub note_path: String,
    pub state: SessionState,
    pub duration_minutes: u32,
    pub annotation_count: u32,
    pub started_at: Option<DateTime<Utc>>,
    pub ended_at: Option<DateTime<Utc>>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;
    use std::time::Duration as StdDuration;

    #[test]
    fn test_session_lifecycle() {
        let mut session = Session::new("test.md".to_string());

        // Initially inactive
        assert_eq!(session.state, SessionState::Inactive);
        assert_eq!(session.current_duration_minutes(), 0);

        // First edit starts session
        session.record_edit();
        assert_eq!(session.state, SessionState::Active);
        assert!(session.started_at.is_some());

        // End session
        session.end();
        assert_eq!(session.state, SessionState::Ended);
        assert!(session.ended_at.is_some());

        // Edit after end is annotation
        session.record_edit();
        assert_eq!(session.annotation_count, 1);
    }

    #[test]
    fn test_inactivity_timeout() {
        let config = SessionConfig {
            inactivity_timeout_minutes: 0, // Immediate timeout for testing
            max_duration_minutes: 120,
        };

        let mut session = Session::new("test.md".to_string());
        session.start();

        // Wait a tiny bit
        thread::sleep(StdDuration::from_millis(10));

        // Should timeout
        assert!(session.check_timeouts(&config));
        assert_eq!(session.state, SessionState::Ended);
    }

    #[test]
    fn test_session_manager() {
        let manager = SessionManager::default();

        manager.open_note("test.md", None);

        // Initially inactive
        let info = manager.get_session_info().unwrap();
        assert_eq!(info.state, SessionState::Inactive);

        // Edit starts session
        manager.record_edit();
        let info = manager.get_session_info().unwrap();
        assert_eq!(info.state, SessionState::Active);

        // End session
        manager.end_session();
        let info = manager.get_session_info().unwrap();
        assert_eq!(info.state, SessionState::Ended);
    }
}
