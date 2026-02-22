use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessedNoteInfo {
    pub note_path: String,
    pub note_name: String,
    pub processed_path: String,
    pub tldr: Option<String>,
    pub tags: Vec<String>,
    pub action_count: usize,
    pub question_count: usize,
    pub processed_at: Option<String>,
}

/// List all processed notes with their summary info
#[tauri::command]
pub async fn list_processed_notes(
    workspace_path: String,
) -> Result<Vec<ProcessedNoteInfo>, String> {
    let processed_dir = Path::new(&workspace_path)
        .join(".chronicle")
        .join("processed");
    if !processed_dir.exists() {
        return Ok(vec![]);
    }

    let mut notes = Vec::new();
    let entries = std::fs::read_dir(&processed_dir)
        .map_err(|e| format!("Failed to read processed dir: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }

        let filename = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        let note_name = filename.trim_end_matches(".json").to_string();

        // Read and parse the processed JSON
        let content = match std::fs::read_to_string(&path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let json: Value = match serde_json::from_str(&content) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let tldr = json
            .get("tldr")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let tags: Vec<String> = json
            .get("tags")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();

        let action_count = json
            .get("actionItems")
            .and_then(|v| v.as_array())
            .map(|arr| arr.len())
            .unwrap_or(0);

        let question_count = json
            .get("questions")
            .and_then(|v| v.as_array())
            .map(|arr| arr.len())
            .unwrap_or(0);

        let processed_at = json
            .get("processedAt")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let note_path = format!("{}.md", note_name);

        notes.push(ProcessedNoteInfo {
            note_path,
            note_name,
            processed_path: path.display().to_string(),
            tldr,
            tags,
            action_count,
            question_count,
            processed_at,
        });
    }

    // Sort by processedAt descending (most recent first)
    notes.sort_by(|a, b| {
        let a_date = a.processed_at.as_deref().unwrap_or("");
        let b_date = b.processed_at.as_deref().unwrap_or("");
        b_date.cmp(a_date)
    });

    Ok(notes)
}
