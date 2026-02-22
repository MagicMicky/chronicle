use serde_json::Value;
use std::path::Path;
use tauri::State;

use crate::watcher::ChronicleWatcher;

/// Directory names inside .chronicle/
const SUBDIRS: &[&str] = &["prompts", "processed", "digests"];

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
