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

#[tauri::command]
pub async fn delete_file(
    path: String,
    state: State<'_, SharedAppState>,
) -> Result<(), String> {
    let workspace = get_workspace_path(&state).await?;
    let workspace_path = Path::new(&workspace);
    let target_path = Path::new(&path);

    // Validate path is within workspace
    let validated = storage::validate_workspace_path(workspace_path, target_path)?;

    // Move to OS trash
    trash::delete(&validated).map_err(|e| format!("Failed to delete file: {}", e))
}

#[tauri::command]
pub async fn create_folder(
    workspace_path: String,
    folder_path: String,
) -> Result<(), String> {
    let ws = Path::new(&workspace_path);
    let target = Path::new(&folder_path);

    // Validate path is within workspace
    let validated = storage::validate_workspace_path(ws, target)?;

    std::fs::create_dir_all(&validated)
        .map_err(|e| format!("Failed to create folder: {}", e))
}

/// Parsed AI output structure for M6 UI display
#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ParsedAIOutput {
    pub tldr: Option<String>,
    pub key_points: Vec<KeyPoint>,
    pub actions: Vec<ActionItem>,
    pub questions: Vec<Question>,
    pub raw_notes: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyPoint {
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_lines: Option<Vec<u32>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionItem {
    pub text: String,
    pub owner: Option<String>,
    pub completed: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_line: Option<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Question {
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_line: Option<u32>,
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
                output.key_points = parse_key_points(&body);
            }
            "Action Items" => {
                output.actions = parse_action_items(&body);
            }
            "Open Questions" => {
                output.questions = parse_questions(&body);
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

/// Extract bullet text from a line, returning None if not a bullet
fn extract_bullet_text(line: &str) -> Option<String> {
    let trimmed = line.trim();
    if let Some(rest) = trimmed.strip_prefix("- ").or_else(|| trimmed.strip_prefix("* ")) {
        Some(rest.trim().to_string())
    } else if let Some(rest) = trimmed.strip_prefix("• ") {
        Some(rest.trim().to_string())
    } else if !trimmed.is_empty() && !trimmed.starts_with('#') {
        Some(trimmed.to_string())
    } else {
        None
    }
}

/// Parse a bullet list into KeyPoint structs with optional source line references
fn parse_key_points(content: &str) -> Vec<KeyPoint> {
    content
        .lines()
        .filter_map(|line| {
            extract_bullet_text(line).filter(|s| !s.is_empty()).map(|text| {
                let (clean_text, source_lines) = extract_source_refs(&text);
                KeyPoint {
                    text: clean_text,
                    source_lines: if source_lines.is_empty() { None } else { Some(source_lines) },
                }
            })
        })
        .collect()
}

/// Parse a bullet list into Question structs with optional source line reference
fn parse_questions(content: &str) -> Vec<Question> {
    content
        .lines()
        .filter_map(|line| {
            extract_bullet_text(line).filter(|s| !s.is_empty()).map(|text| {
                let (clean_text, source_lines) = extract_source_refs(&text);
                Question {
                    text: clean_text,
                    source_line: source_lines.into_iter().next(),
                }
            })
        })
        .collect()
}

/// Extract source line references like [L12] or [L5, L8] from text
fn extract_source_refs(text: &str) -> (String, Vec<u32>) {
    let mut lines = Vec::new();
    // Match patterns like [L12] or [L5, L8] at end of text
    if let Some(bracket_start) = text.rfind('[') {
        let rest = &text[bracket_start..];
        if rest.ends_with(']') && rest.contains('L') {
            let inner = &rest[1..rest.len() - 1];
            for part in inner.split(',') {
                let part = part.trim();
                if let Some(num_str) = part.strip_prefix('L') {
                    if let Ok(n) = num_str.trim().parse::<u32>() {
                        lines.push(n);
                    }
                }
            }
            if !lines.is_empty() {
                return (text[..bracket_start].trim().to_string(), lines);
            }
        }
    }
    (text.to_string(), lines)
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

            let (clean_text, source_lines) = extract_source_refs(&text);
            Some(ActionItem {
                text: clean_text,
                owner,
                completed,
                source_line: source_lines.into_iter().next(),
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_processed_content_with_all_sections() {
        let content = "# Meeting Notes\n\n## TL;DR\nThis was a productive meeting.\n\n## Key Points\n- Point one\n- Point two\n\n## Action Items\n- [ ] Do thing one \u{2014} @alice\n- [x] Already done \u{2014} @bob\n\n## Open Questions\n- What about timeline?\n";
        let result = parse_processed_content(content);
        assert_eq!(
            result.tldr,
            Some("This was a productive meeting.".to_string())
        );
        assert_eq!(result.key_points.len(), 2);
        assert_eq!(result.key_points[0].text, "Point one");
        assert_eq!(result.key_points[1].text, "Point two");
        assert!(result.key_points[0].source_lines.is_none());
        assert_eq!(result.actions.len(), 2);
        assert!(!result.actions[0].completed);
        assert!(result.actions[1].completed);
        assert_eq!(result.actions[0].owner, Some("alice".to_string()));
        assert_eq!(result.actions[1].owner, Some("bob".to_string()));
        assert_eq!(result.questions.len(), 1);
        assert_eq!(result.questions[0].text, "What about timeline?");
        assert!(result.questions[0].source_line.is_none());
    }

    #[test]
    fn test_parse_empty_content() {
        let result = parse_processed_content("");
        assert!(result.tldr.is_none());
        assert!(result.key_points.is_empty());
        assert!(result.actions.is_empty());
        assert!(result.questions.is_empty());
        assert!(result.raw_notes.is_none());
    }

    #[test]
    fn test_parse_content_with_only_tldr() {
        // Parser requires a # title line before ## sections (split on \n## )
        let content = "# Title\n\n## TL;DR\nJust a summary, nothing else.";
        let result = parse_processed_content(content);
        assert_eq!(
            result.tldr,
            Some("Just a summary, nothing else.".to_string())
        );
        assert!(result.key_points.is_empty());
        assert!(result.actions.is_empty());
    }

    #[test]
    fn test_parse_action_items_without_owner() {
        let content = "# Title\n\n## Action Items\n- [ ] Do something\n- [ ] Do another thing\n";
        let result = parse_processed_content(content);
        assert_eq!(result.actions.len(), 2);
        assert!(result.actions[0].owner.is_none());
        assert!(!result.actions[0].completed);
    }

    #[test]
    fn test_parse_bullet_list_with_different_prefixes() {
        let content = "# Title\n\n## Key Points\n- Dash item\n* Star item\n";
        let result = parse_processed_content(content);
        assert_eq!(result.key_points.len(), 2);
        assert_eq!(result.key_points[0].text, "Dash item");
        assert_eq!(result.key_points[1].text, "Star item");
    }

    #[test]
    fn test_parse_content_with_raw_notes_section() {
        let content =
            "# Title\n\n## TL;DR\nSummary here.\n\n## Raw Notes\nOriginal raw content here.\n";
        let result = parse_processed_content(content);
        assert!(result.raw_notes.is_some());
        assert_eq!(
            result.raw_notes.unwrap(),
            "Original raw content here."
        );
    }

    #[test]
    fn test_parse_content_ignores_unknown_sections() {
        let content = "# Title\n\n## TL;DR\nSummary.\n\n## Random Section\nSome content.\n\n## Key Points\n- Point A\n";
        let result = parse_processed_content(content);
        assert_eq!(result.tldr, Some("Summary.".to_string()));
        assert_eq!(result.key_points.len(), 1);
    }
}
