use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::Path;
use tauri::State;

use crate::watcher::ChronicleWatcher;
use crate::SharedAppState;

/// Directory names inside .chronicle/
const SUBDIRS: &[&str] = &["prompts", "processed", "digests", "templates"];

/// JSON index files with their default contents
const INDEX_FILES: &[(&str, &str)] = &[
    ("tags.json", "{}"),
    ("actions.json", "[]"),
    ("links.json", "{}"),
    ("agent-runs.json", "{}"),
    ("state.json", "{}"),
];

/// Default prompt file contents
const PROCESS_PROMPT: &str = r#"You are Chronicle's note processor. Your job is to transform raw meeting notes into a structured summary.

Read .chronicle/state.json to find the current workspace path.
Read the note file specified in the task.

The note may contain semantic markers:
- Lines starting with > are the author's thoughts
- Lines starting with ! are important points
- Lines starting with ? are questions
- Lines starting with [] are action items (unchecked)
- Lines starting with [x] are completed action items
- Lines starting with @ attribute text to a person

Create a structured output and write it as JSON to .chronicle/processed/{filename}.json with this schema:
{
  "tldr": "2-3 sentence summary",
  "keyPoints": ["point1", "point2"],
  "actionItems": [{"text": "...", "owner": "...", "done": false}],
  "questions": ["question1", "question2"],
  "tags": ["tag1", "tag2"],
  "processedAt": "ISO timestamp"
}

Also write a human-readable version to .chronicle/processed/{filename}.md with sections:
## TL;DR
## Key Points
## Action Items
## Open Questions
"#;

const TAGGER_PROMPT: &str = r#"You are Chronicle's tagger. Your job is to extract meaningful tags from notes.

Read .chronicle/agent-runs.json to find when the tagger last ran.
Read .chronicle/tags.json for the current tag index.

Find all .md files in the workspace that were modified after the last tagger run.
For each modified note, extract tags:
- People mentioned (@ markers or names in context) -> #person-name
- Projects or topics discussed -> #project-name
- Meeting types -> #standup, #1on1, #planning, etc.
- Themes -> #architecture, #hiring, #budget, etc.

Update .chronicle/tags.json with this schema:
{
  "byNote": {
    "path/to/note.md": ["tag1", "tag2"]
  },
  "byTag": {
    "tag1": ["path/to/note1.md", "path/to/note2.md"]
  }
}

Update .chronicle/agent-runs.json with: {"tagger": "ISO timestamp"}
"#;

const ACTIONS_PROMPT: &str = r#"You are Chronicle's action tracker. Your job is to find and track action items across all notes.

Read .chronicle/actions.json for existing tracked actions.
Read .chronicle/agent-runs.json for last run time.

Scan all .md files in the workspace for action items:
- [] markers = open action items
- [x] markers = completed action items
- Look for implicit actions ("need to", "should", "will", "TODO")

For each action item found:
- Extract the text
- Identify the owner (from @ marker or context)
- Note which file it came from and what line
- Determine status: open, done, or stale (open + older than 7 days)

Write updated .chronicle/actions.json:
[
  {
    "text": "Follow up with Sarah on API timeline",
    "owner": "me",
    "source": "2026-02-22-standup.md",
    "line": 15,
    "created": "2026-02-22",
    "status": "open|done|stale"
  }
]

Update .chronicle/agent-runs.json with: {"actions": "ISO timestamp"}
"#;

/// Default template files
const DEFAULT_TEMPLATES: &[(&str, &str)] = &[
    (
        "blank.md",
        "# {{title}}\n\n",
    ),
    (
        "meeting.md",
        "# Meeting: [Topic]\n\n**Date:** {{date}}\n**Attendees:** \n\n## Notes\n\n## Action Items\n\n## Decisions\n",
    ),
    (
        "one-on-one.md",
        "# 1:1 with [Name]\n\n**Date:** {{date}}\n\n## Updates\n\n## Discussion\n\n## Action Items\n\n## Feedback\n",
    ),
    (
        "standup.md",
        "# Standup — {{date}}\n\n## Yesterday\n\n## Today\n\n## Blockers\n",
    ),
];

/// Template info returned to frontend
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateInfo {
    pub name: String,
    pub filename: String,
    pub content: String,
    pub description: String,
}

/// Derive a human-readable name and description from a template filename
fn template_meta(filename: &str) -> (String, String) {
    let base = filename.trim_end_matches(".md");
    match base {
        "blank" => ("Blank Note".into(), "Start with an empty note".into()),
        "meeting" => ("Meeting".into(), "Agenda, notes, and action items".into()),
        "one-on-one" => ("1:1".into(), "Updates, discussion, and feedback".into()),
        "standup" => ("Standup".into(), "Yesterday, today, and blockers".into()),
        other => {
            let name = other
                .replace('-', " ")
                .replace('_', " ");
            // Capitalize first letter of each word
            let name = name
                .split_whitespace()
                .map(|w| {
                    let mut c = w.chars();
                    match c.next() {
                        None => String::new(),
                        Some(f) => f.to_uppercase().to_string() + c.as_str(),
                    }
                })
                .collect::<Vec<_>>()
                .join(" ");
            let desc = format!("{} template", name);
            (name, desc)
        }
    }
}

/// Initialize the .chronicle/ directory structure in a workspace.
/// Creates subdirectories, default JSON index files, and prompt files.
/// Does not overwrite existing files.
pub fn init_chronicle_dir(workspace_path: &Path) -> Result<(), String> {
    let chronicle_dir = workspace_path.join(".chronicle");

    // Create main directory and subdirectories
    for subdir in SUBDIRS {
        let dir_path = chronicle_dir.join(subdir);
        std::fs::create_dir_all(&dir_path)
            .map_err(|e| format!("Failed to create {}: {}", dir_path.display(), e))?;
    }

    // Create default JSON index files (don't overwrite)
    for (filename, default_content) in INDEX_FILES {
        let file_path = chronicle_dir.join(filename);
        if !file_path.exists() {
            std::fs::write(&file_path, default_content)
                .map_err(|e| format!("Failed to write {}: {}", file_path.display(), e))?;
        }
    }

    // Create default prompt files (don't overwrite)
    let prompts = &[
        ("process.md", PROCESS_PROMPT),
        ("tagger.md", TAGGER_PROMPT),
        ("actions.md", ACTIONS_PROMPT),
    ];
    for (filename, content) in prompts {
        let file_path = chronicle_dir.join("prompts").join(filename);
        if !file_path.exists() {
            std::fs::write(&file_path, content)
                .map_err(|e| format!("Failed to write {}: {}", file_path.display(), e))?;
        }
    }

    // Create default template files (don't overwrite)
    for (filename, content) in DEFAULT_TEMPLATES {
        let file_path = chronicle_dir.join("templates").join(filename);
        if !file_path.exists() {
            std::fs::write(&file_path, content)
                .map_err(|e| format!("Failed to write {}: {}", file_path.display(), e))?;
        }
    }

    tracing::info!(
        "Initialized .chronicle/ in {}",
        workspace_path.display()
    );

    Ok(())
}

/// Start the filesystem watcher for .chronicle/ in the given workspace
#[tauri::command]
pub async fn start_chronicle_watcher(
    app_handle: tauri::AppHandle,
    watcher_state: State<'_, ChronicleWatcher>,
    workspace_path: String,
) -> Result<(), String> {
    watcher_state.start(&workspace_path, app_handle)
}

/// Read .chronicle/tags.json
#[tauri::command]
pub async fn read_tags(workspace_path: String) -> Result<Value, String> {
    read_chronicle_file(&workspace_path, "tags.json")
}

/// Read .chronicle/actions.json
#[tauri::command]
pub async fn read_actions(workspace_path: String) -> Result<Value, String> {
    read_chronicle_file(&workspace_path, "actions.json")
}

/// Read .chronicle/links.json
#[tauri::command]
pub async fn read_links(workspace_path: String) -> Result<Value, String> {
    read_chronicle_file(&workspace_path, "links.json")
}

/// Read .chronicle/processed/{note_name}.json
#[tauri::command]
pub async fn read_processed(workspace_path: String, note_name: String) -> Result<Value, String> {
    let path = Path::new(&workspace_path)
        .join(".chronicle")
        .join("processed")
        .join(format!("{}.json", note_name));

    if !path.exists() {
        return Ok(Value::Null);
    }

    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;

    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse {}: {}", path.display(), e))
}

/// Read .chronicle/agent-runs.json
#[tauri::command]
pub async fn get_agent_status(workspace_path: String) -> Result<Value, String> {
    read_chronicle_file(&workspace_path, "agent-runs.json")
}

/// Helper to read a JSON file from .chronicle/
fn read_chronicle_file(workspace_path: &str, filename: &str) -> Result<Value, String> {
    let path = Path::new(workspace_path)
        .join(".chronicle")
        .join(filename);

    if !path.exists() {
        // Return the appropriate empty default
        return match filename {
            "actions.json" => Ok(Value::Array(vec![])),
            _ => Ok(Value::Object(serde_json::Map::new())),
        };
    }

    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;

    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse {}: {}", path.display(), e))
}

/// List available templates from .chronicle/templates/
#[tauri::command]
pub async fn list_templates(
    state: State<'_, SharedAppState>,
) -> Result<Vec<TemplateInfo>, String> {
    let app_state = state.read().await;
    let workspace_path = app_state
        .workspace_path
        .as_ref()
        .ok_or_else(|| "No workspace open".to_string())?;

    let templates_dir = Path::new(workspace_path)
        .join(".chronicle")
        .join("templates");

    if !templates_dir.exists() {
        return Ok(vec![]);
    }

    let mut templates = Vec::new();
    let entries = std::fs::read_dir(&templates_dir)
        .map_err(|e| format!("Failed to read templates dir: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }
        let filename = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        let content = std::fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read template {}: {}", filename, e))?;

        let (name, description) = template_meta(&filename);

        templates.push(TemplateInfo {
            name,
            filename,
            content,
            description,
        });
    }

    // Sort: "Blank Note" first, then alphabetical
    templates.sort_by(|a, b| {
        if a.filename == "blank.md" {
            std::cmp::Ordering::Less
        } else if b.filename == "blank.md" {
            std::cmp::Ordering::Greater
        } else {
            a.name.cmp(&b.name)
        }
    });

    Ok(templates)
}

/// Replace template placeholders with actual values
fn replace_placeholders(content: &str) -> String {
    let now = chrono::Local::now();
    let date_str = now.format("%B %d, %Y").to_string();
    content
        .replace("{{date}}", &date_str)
        .replace("{{title}}", "New Note")
}

/// Create a new note from a template
#[tauri::command]
pub async fn create_from_template(
    template_filename: String,
    folder_path: Option<String>,
    state: State<'_, SharedAppState>,
) -> Result<(String, String), String> {
    let app_state = state.read().await;
    let workspace_path = app_state
        .workspace_path
        .as_ref()
        .ok_or_else(|| "No workspace open".to_string())?
        .clone();
    drop(app_state);

    let template_path = Path::new(&workspace_path)
        .join(".chronicle")
        .join("templates")
        .join(&template_filename);

    let raw_content = std::fs::read_to_string(&template_path)
        .map_err(|e| format!("Failed to read template: {}", e))?;

    let content = replace_placeholders(&raw_content);

    // Generate a unique path in the target folder (or workspace root)
    let target_dir = folder_path.unwrap_or_else(|| workspace_path.clone());
    let note_path =
        crate::storage::generate_unique_path(Path::new(&target_dir), &content);

    // Write the new note
    crate::storage::write_file_atomic(&note_path, &content)
        .map_err(|e| format!("Failed to write note: {}", e))?;

    let path_str = note_path.display().to_string();
    Ok((path_str, content))
}
