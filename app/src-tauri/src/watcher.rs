use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Emitter;

/// Managed state that keeps the filesystem watcher alive
pub struct ChronicleWatcher {
    inner: Mutex<Option<RecommendedWatcher>>,
}

impl ChronicleWatcher {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(None),
        }
    }

    /// Start watching the .chronicle/ directory for a workspace
    pub fn start(&self, workspace_path: &str, app_handle: tauri::AppHandle) -> Result<(), String> {
        let chronicle_dir = PathBuf::from(workspace_path).join(".chronicle");
        if !chronicle_dir.exists() {
            return Err("Chronicle directory does not exist".to_string());
        }

        let processed_dir = chronicle_dir.join("processed");

        let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                match event.kind {
                    EventKind::Create(_) | EventKind::Modify(_) => {
                        for path in &event.paths {
                            let filename = path
                                .file_name()
                                .unwrap_or_default()
                                .to_string_lossy();
                            match filename.as_ref() {
                                "tags.json" => {
                                    let _ = app_handle.emit("chronicle:tags-updated", ());
                                }
                                "actions.json" => {
                                    let _ = app_handle.emit("chronicle:actions-updated", ());
                                }
                                "links.json" => {
                                    let _ = app_handle.emit("chronicle:links-updated", ());
                                }
                                _ => {
                                    if path.starts_with(&processed_dir) {
                                        let _ = app_handle
                                            .emit("chronicle:processed-updated", ());
                                    }
                                }
                            }
                        }
                    }
                    _ => {}
                }
            }
        })
        .map_err(|e| format!("Failed to create watcher: {}", e))?;

        watcher
            .watch(&chronicle_dir, RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to watch .chronicle/: {}", e))?;

        tracing::info!(
            "Started filesystem watcher on {}",
            chronicle_dir.display()
        );

        let mut guard = self.inner.lock().map_err(|e| e.to_string())?;
        *guard = Some(watcher);

        Ok(())
    }

    /// Stop the current watcher
    #[allow(dead_code)]
    pub fn stop(&self) {
        if let Ok(mut guard) = self.inner.lock() {
            if guard.take().is_some() {
                tracing::info!("Stopped filesystem watcher");
            }
        }
    }
}
