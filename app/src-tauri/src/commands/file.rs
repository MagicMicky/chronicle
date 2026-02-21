use crate::storage;
use crate::SharedAppState;
use serde::Serialize;
use std::env;
use std::path::Path;
use tauri::State;

/// Maximum file size: 50MB
const MAX_FILE_SIZE: u64 = 50 * 1024 * 1024;

/// Get workspace path from shared app state, returning an error if not set
async fn get_workspace_path(state: &SharedAppState) -> Result<String, String> {
    let app_state = state.read().await;
    app_state
        .workspace_path
        .clone()
        .ok_or_else(|| "No workspace open".to_string())
}

#[tauri::command]
pub async fn read_file(
    path: String,
    state: State<'_, SharedAppState>,
) -> Result<String, String> {
    let workspace = get_workspace_path(&state).await?;
    let workspace_path = Path::new(&workspace);
    let target_path = Path::new(&path);

    // Validate path is within workspace
    let validated = storage::validate_workspace_path(workspace_path, target_path)?;

    // Check file size before reading
    let metadata = std::fs::metadata(&validated)
        .map_err(|e| format!("Cannot access file: {}", e))?;
    if metadata.len() > MAX_FILE_SIZE {
        return Err(format!(
            "File exceeds maximum size of {}MB",
            MAX_FILE_SIZE / (1024 * 1024)
        ));
    }

    storage::read_file(&validated).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn write_file(
    path: String,
    content: String,
    state: State<'_, SharedAppState>,
) -> Result<(), String> {
    let workspace = get_workspace_path(&state).await?;
    let workspace_path = Path::new(&workspace);
    let target_path = Path::new(&path);

    // Validate path is within workspace
    let validated = storage::validate_workspace_path(workspace_path, target_path)?;

    // Check content size before writing
    if content.len() as u64 > MAX_FILE_SIZE {
        return Err(format!(
            "Content exceeds maximum size of {}MB",
            MAX_FILE_SIZE / (1024 * 1024)
        ));
    }

    storage::write_file_atomic(&validated, &content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn file_exists(path: String) -> bool {
    storage::file_exists(Path::new(&path))
}

#[tauri::command]
pub async fn suggest_rename(path: String, content: String) -> Option<String> {
    storage::suggest_path(Path::new(&path), &content).map(|p| p.display().to_string())
}

#[tauri::command]
pub async fn rename_file(old_path: String, new_path: String) -> Result<String, String> {
    storage::rename_file(Path::new(&old_path), Path::new(&new_path))
        .map(|p| p.display().to_string())
        .map_err(|e| e.to_string())
}

/// Generate a unique path for a new note (handles conflicts with suffixes)
#[tauri::command]
pub async fn generate_note_path(workspace_path: String, content: String) -> String {
    storage::generate_unique_path(Path::new(&workspace_path), &content)
        .display()
        .to_string()
}

/// Get the user's default shell from environment
#[tauri::command]
pub fn get_default_shell() -> String {
    if cfg!(target_os = "windows") {
        // Windows: prefer PowerShell
        env::var("COMSPEC").unwrap_or_else(|_| "powershell.exe".to_string())
    } else {
        // Unix: use SHELL env var, fallback to /bin/sh
        env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string())
    }
}

/// Parsed AI output structure for M6 UI display
#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ParsedAIOutput {
    pub tldr: Option<String>,
    pub key_points: Vec<String>,
    pub actions: Vec<ActionItem>,
    pub questions: Vec<String>,
    pub raw_notes: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ActionItem {
    pub text: String,
    pub owner: Option<String>,
    pub completed: bool,
}

/// Read a processed markdown file and parse its structured sections
#[tauri::command]
pub async fn read_processed_file(
    path: String,
    state: State<'_, SharedAppState>,
) -> Result<ParsedAIOutput, String> {
    let workspace = get_workspace_path(&state).await?;
    let workspace_path = Path::new(&workspace);
    let target_path = Path::new(&path);

    // Validate path is within workspace
    let validated = storage::validate_workspace_path(workspace_path, target_path)?;

    let content = storage::read_file(&validated).map_err(|e| e.to_string())?;
    Ok(parse_processed_content(&content))
}

/// Parse processed markdown content into structured sections
fn parse_processed_content(content: &str) -> ParsedAIOutput {
    let mut output = ParsedAIOutput::default();

    // Split content by ## headers
    let sections: Vec<&str> = content.split("\n## ").collect();

    for (i, section) in sections.iter().enumerate() {
        // First section might have # title, skip it
        if i == 0 && !section.starts_with("TL;DR") {
            continue;
        }

        let lines: Vec<&str> = section.lines().collect();
        if lines.is_empty() {
            continue;
        }

        let header = lines[0].trim();
        let body: String = lines[1..].join("\n").trim().to_string();

        match header {
            "TL;DR" => {
                if !body.is_empty() {
                    output.tldr = Some(body);
                }
            }
            "Key Points" => {
                output.key_points = parse_bullet_list(&body);
            }
            "Action Items" => {
                output.actions = parse_action_items(&body);
            }
            "Open Questions" => {
                output.questions = parse_bullet_list(&body);
            }
            "Raw Notes" => {
                if !body.is_empty() {
                    output.raw_notes = Some(body);
                }
            }
            _ => {}
        }
    }

    output
}

/// Parse a bullet list into a vector of strings
fn parse_bullet_list(content: &str) -> Vec<String> {
    content
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim();
            if let Some(rest) = trimmed.strip_prefix("- ").or_else(|| trimmed.strip_prefix("* ")) {
                Some(rest.trim().to_string())
            } else if let Some(rest) = trimmed.strip_prefix("• ") {
                Some(rest.trim().to_string())
            } else if !trimmed.is_empty() && !trimmed.starts_with('#') {
                // Handle continuation lines or non-bulleted items
                Some(trimmed.to_string())
            } else {
                None
            }
        })
        .filter(|s| !s.is_empty())
        .collect()
}

/// Parse action items with checkbox state and owner detection
fn parse_action_items(content: &str) -> Vec<ActionItem> {
    content
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim();

            // Check for checkbox pattern: - [ ] or - [x]
            let (completed, text_part) = if let Some(rest) = trimmed.strip_prefix("- [ ] ") {
                (false, rest)
            } else if let Some(rest) = trimmed.strip_prefix("- [x] ").or_else(|| trimmed.strip_prefix("- [X] ")) {
                (true, rest)
            } else if let Some(rest) = trimmed.strip_prefix("- ").or_else(|| trimmed.strip_prefix("* ")) {
                (false, rest)
            } else {
                return None;
            };

            let text_part = text_part.trim();
            if text_part.is_empty() {
                return None;
            }

            // Try to extract owner from patterns like " — @owner" or " — owner"
            let separator = " — ";
            let (text, owner) = if let Some(dash_pos) = text_part.find(separator) {
                let main_text = text_part[..dash_pos].trim();
                let owner_part = text_part[dash_pos + separator.len()..].trim();
                let owner = owner_part.strip_prefix('@').unwrap_or(owner_part);
                // Check if it looks like an owner (single word or comma-separated names)
                if !owner.is_empty() && (!owner.contains(' ') || owner.contains(',')) {
                    (main_text.to_string(), Some(owner.to_string()))
                } else {
                    (text_part.to_string(), None)
                }
            } else {
                (text_part.to_string(), None)
            };

            Some(ActionItem {
                text,
                owner,
                completed,
            })
        })
        .collect()
}
