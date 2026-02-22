use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::Path;
use tauri::State;

use crate::watcher::ChronicleWatcher;
use crate::SharedAppState;

/// Directory names inside .chronicle/
const SUBDIRS: &[&str] = &["prompts", "processed", "digests", "templates", "entities", "commands"];

/// JSON index files with their default contents
const INDEX_FILES: &[(&str, &str)] = &[
    ("tags.json", "{}"),
    ("actions.json", "[]"),
    ("links.json", "{}"),
    ("agent-runs.json", "{}"),
    ("state.json", "{}"),
];

/// Default context.md template for workspace memory
const CONTEXT_TEMPLATE: &str = r##"# Workspace Context

Chronicle reads this file before every processing and tagging run to maintain context across sessions. Edit it freely — your changes are preserved.

## People
<!-- Add people you frequently mention in notes -->
<!-- Format: **Name** — Role, relationship, context -->

## Active Projects
<!-- Format: **Project Name** — Status, key stakeholders, timeline -->

## Recurring Meetings
<!-- Format: **Meeting Name** — Cadence, typical attendees, format -->

## Terminology
<!-- Domain-specific terms, acronyms, shorthand -->
<!-- Format: **TERM** — Definition -->

## Preferences
<!-- How you want Chronicle to process your notes -->
<!-- Examples: "Always use bullet points", "Refer to me as 'I'", "Flag any mention of budget" -->

---
*Auto-discovered entries appear below this line. Feel free to move them above and edit.*

<!-- Auto-discovered -->
"##;

/// Default prompt file contents
const PROCESS_PROMPT: &str = r#"You are Chronicle's note processor. Your job is to transform raw meeting notes into a structured summary.

First, read .chronicle/context.md to understand the workspace context — people, projects, terminology, and user preferences. Use this context to resolve ambiguous names, apply correct terminology, and follow user preferences.

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
  "entities": {
    "people": [
      { "name": "Sarah Chen", "role": "discussed API timeline", "markers": ["@sarah"] }
    ],
    "decisions": [
      { "text": "Go with GraphQL over REST", "participants": ["sarah", "marcus"] }
    ],
    "topics": ["api-redesign", "graphql-migration"],
    "references": ["2026-02-15-planning.md"]
  },
  "processedAt": "ISO timestamp"
}

Entity extraction guidelines:
- **People**: Extract from @ markers, names in context. Include their role/context in this note.
- **Decisions**: Look for explicit decisions, agreements, resolutions. Include who participated.
- **Topics**: Main discussion topics as lowercase slugs.
- **References**: Any mentions of other notes, dates, or meetings (e.g., "last Tuesday's standup", "the planning doc").

Also write a human-readable version to .chronicle/processed/{filename}.md with sections:
## TL;DR
## Key Points
## Action Items
## Open Questions
"#;

const TAGGER_PROMPT: &str = r##"You are Chronicle's tagger. Your job is to extract meaningful categorized tags from notes.

Read .chronicle/agent-runs.json to find when the tagger last ran.
Read .chronicle/tags.json for the current tag index (including any existing categories).
Read .chronicle/context.md for workspace context — known people, projects, and terminology. Use this to map names to existing person tags and resolve ambiguous references.

Find all .md files in the workspace that were modified after the last tagger run.
For each modified note, extract tags using the category:name format:
- People mentioned (@ markers or names in context) -> person:john, person:sarah
- Projects or topics discussed -> topic:api-redesign, topic:onboarding
- Meeting types -> meeting:standup, meeting:1on1, meeting:planning
- Projects -> project:chronicle, project:backend
- Themes -> theme:architecture, theme:hiring, theme:budget

IMPORTANT: Always use lowercase category:name format. Reuse existing categories and tag names from the current tags.json when they match. Create new categories only when you discover genuinely new patterns (e.g. "location:office", "priority:high").

Default seed categories (use these unless a better fit exists):
- person: People
- topic: Topics
- meeting: Meeting Type
- project: Projects
- theme: Themes

Update .chronicle/tags.json with this schema:
{
  "categories": {
    "person": { "label": "People", "color": "#c586c0" },
    "topic": { "label": "Topics", "color": "#569cd6" },
    "meeting": { "label": "Meeting Type", "color": "#d7ba7d" },
    "project": { "label": "Projects", "color": "#4ec9b0" },
    "theme": { "label": "Themes", "color": "#ce9178" }
  },
  "byNote": {
    "path/to/note.md": ["person:john", "topic:architecture"]
  },
  "byTag": {
    "person:john": ["path/to/note1.md"],
    "topic:architecture": ["path/to/note1.md", "path/to/note2.md"]
  }
}

Preserve any existing categories and their colors. Add new categories as you discover them.
Update .chronicle/agent-runs.json with: {"tagger": "ISO timestamp"}
"##;

const ACTIONS_PROMPT: &str = r#"You are Chronicle's action tracker. Your job is to find and track action items across all notes.

Read .chronicle/actions.json for existing tracked actions.
Read .chronicle/agent-runs.json for last run time.
Read .chronicle/context.md for workspace context. Use it to identify action item owners by name and resolve references like "Sarah" to the correct person.

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

const CONTEXT_UPDATER_PROMPT: &str = r##"You are Chronicle's context updater. Your job is to discover new people, projects, and terminology from recently processed notes and append them to .chronicle/context.md.

Read .chronicle/context.md for existing context.
Read .chronicle/agent-runs.json to find when the context updater last ran.
Read all .chronicle/processed/*.json files modified after the last run.

For each processed note, look for:
- New people not already in context.md (from @ markers, action item owners, attendees)
- New projects not already listed
- New terminology or acronyms used consistently

Append discoveries to the "<!-- Auto-discovered -->" section of .chronicle/context.md using the established format. Do NOT modify existing content above the auto-discovered line.

Update .chronicle/agent-runs.json with: {"context-updater": "ISO timestamp"}
"##;

const DIGEST_PROMPT: &str = r##"You are Chronicle's digest generator. Your job is to create periodic summaries across multiple notes.

Read .chronicle/context.md for workspace context.
Read .chronicle/agent-runs.json to find when the last digest was generated.

Based on the requested range, find all processed notes in .chronicle/processed/ within that timeframe.
Also read .chronicle/actions.json for action item status and .chronicle/tags.json for topic mapping.

Generate a digest covering:

## Summary
A 2-3 paragraph overview of the period.

## Meetings & Notes
Count and list with one-line summaries, ordered by date.

## Key Decisions
Decisions extracted from processed notes, with source attribution.

## Action Items
- **New**: Created during this period
- **Completed**: Resolved during this period
- **Overdue**: Open items older than 7 days

## Themes & Topics
Recurring topics that appeared across multiple notes, with note counts.

## People
Most-mentioned people and their involvement context.

## Open Questions
Unresolved questions aggregated from all notes in the period.

Write the digest as markdown to the specified output path.
"##;

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

    // Create context.md (don't overwrite)
    let context_path = chronicle_dir.join("context.md");
    if !context_path.exists() {
        std::fs::write(&context_path, CONTEXT_TEMPLATE)
            .map_err(|e| format!("Failed to write {}: {}", context_path.display(), e))?;
    }

    // Create default prompt files (don't overwrite)
    let prompts = &[
        ("process.md", PROCESS_PROMPT),
        ("tagger.md", TAGGER_PROMPT),
        ("actions.md", ACTIONS_PROMPT),
        ("context-updater.md", CONTEXT_UPDATER_PROMPT),
        ("digest.md", DIGEST_PROMPT),
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

    // Create seed command files (don't overwrite)
    for (filename, content) in SEED_COMMANDS {
        let file_path = chronicle_dir.join("commands").join(filename);
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

/// Read .chronicle/context.md
#[tauri::command]
pub async fn read_context(workspace_path: String) -> Result<String, String> {
    let path = Path::new(&workspace_path).join(".chronicle").join("context.md");
    if !path.exists() {
        return Ok(String::new());
    }
    std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read context: {}", e))
}

/// Read entities from a processed note's JSON
#[tauri::command]
pub async fn read_entities(workspace_path: String, note_name: String) -> Result<Value, String> {
    let path = Path::new(&workspace_path)
        .join(".chronicle")
        .join("processed")
        .join(format!("{}.json", note_name));

    if !path.exists() {
        return Ok(Value::Null);
    }

    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read: {}", e))?;

    let json: Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse: {}", e))?;

    // Return just the entities field, or null if not present
    Ok(json.get("entities").cloned().unwrap_or(Value::Null))
}

/// List all entities across all processed notes (aggregated)
#[tauri::command]
pub async fn list_all_entities(workspace_path: String) -> Result<Value, String> {
    let processed_dir = Path::new(&workspace_path).join(".chronicle").join("processed");
    if !processed_dir.exists() {
        return Ok(serde_json::json!({ "people": [], "decisions": [], "topics": [], "references": [] }));
    }

    let mut all_people: Vec<Value> = Vec::new();
    let mut all_decisions: Vec<Value> = Vec::new();
    let mut all_topics: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut all_references: Vec<Value> = Vec::new();

    let entries = std::fs::read_dir(&processed_dir)
        .map_err(|e| format!("Failed to read processed dir: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }

        let content = match std::fs::read_to_string(&path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let json: Value = match serde_json::from_str(&content) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let source = path.file_stem()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        if let Some(entities) = json.get("entities") {
            // People
            if let Some(people) = entities.get("people").and_then(|v| v.as_array()) {
                for person in people {
                    let mut p = person.clone();
                    if let Some(obj) = p.as_object_mut() {
                        obj.insert("source".to_string(), Value::String(source.clone()));
                    }
                    all_people.push(p);
                }
            }

            // Decisions
            if let Some(decisions) = entities.get("decisions").and_then(|v| v.as_array()) {
                for decision in decisions {
                    let mut d = decision.clone();
                    if let Some(obj) = d.as_object_mut() {
                        obj.insert("source".to_string(), Value::String(source.clone()));
                    }
                    all_decisions.push(d);
                }
            }

            // Topics
            if let Some(topics) = entities.get("topics").and_then(|v| v.as_array()) {
                for topic in topics {
                    if let Some(t) = topic.as_str() {
                        all_topics.insert(t.to_string());
                    }
                }
            }

            // References
            if let Some(refs) = entities.get("references").and_then(|v| v.as_array()) {
                for r in refs {
                    let mut ref_val = serde_json::json!({ "ref": r });
                    if let Some(obj) = ref_val.as_object_mut() {
                        obj.insert("source".to_string(), Value::String(source.clone()));
                    }
                    all_references.push(ref_val);
                }
            }
        }
    }

    Ok(serde_json::json!({
        "people": all_people,
        "decisions": all_decisions,
        "topics": all_topics.into_iter().collect::<Vec<_>>(),
        "references": all_references,
    }))
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

// ── Seed command files for .chronicle/commands/ ──

const PREP_MEETING_CMD: &str = r#"# Prep for Meeting

Prepare a brief for my upcoming meeting with {{person}}.

Read .chronicle/context.md for background on this person.
Search all notes for mentions of {{person}} (check both @ markers and name references).
Read the last 3-5 notes that mention them.

Summarize:
1. **Open action items** between us (from .chronicle/actions.json where owner involves either of us)
2. **Recent discussion topics** — what we talked about in the last few meetings
3. **Pending decisions** — anything unresolved that involves them
4. **Key context** — their current projects, recent concerns

Output as a concise prep brief I can review in 2 minutes before the meeting.
Write the brief to .chronicle/digests/prep-{{person}}.md
"#;

const WEEKLY_REVIEW_CMD: &str = r#"# Weekly Review

Generate a summary of this week's notes.

Read .chronicle/context.md for workspace context.
Find all .md notes in the workspace modified in the last 7 days.
Read their processed versions from .chronicle/processed/ if available.

Produce a weekly review covering:
1. **Meetings held** — count and list with one-line summaries
2. **Key decisions made** — extracted from processed notes
3. **Action items created** — new this week, grouped by owner
4. **Action items completed** — resolved this week
5. **Overdue items** — open actions older than 7 days
6. **Recurring themes** — topics that appeared in 3+ meetings
7. **Notable quotes or insights** — marked with > or ! in notes

Write the review to .chronicle/digests/weekly-{{date}}.md
"#;

const EXTRACT_DECISIONS_CMD: &str = r#"# Extract Decisions

Find all decisions made across recent notes.

Read .chronicle/context.md for context.
Read all .chronicle/processed/*.json files from the last {{days}} days (default: 14).

For each processed note, look for:
- Explicit decisions (key points phrased as decisions)
- Agreements ("we agreed", "decided to", "going with")
- Resolutions to previously open questions

Output a decision log:
- **Decision**: What was decided
- **Date**: When it was discussed
- **Source**: Which note
- **Participants**: Who was involved
- **Status**: Active / Superseded / Pending implementation

Write to .chronicle/digests/decisions-{{date}}.md
"#;

const FIND_STALE_ACTIONS_CMD: &str = r#"# Find Stale Actions

Identify overdue and stale action items.

Read .chronicle/actions.json for all tracked actions.
Read .chronicle/context.md for people context.

Find all actions that are:
1. **Overdue** — open for more than 7 days
2. **Unassigned** — no clear owner
3. **Blocked** — mentioned as blocked or waiting in subsequent notes

For each stale action:
- Show the action text and original source
- How many days old it is
- Suggest: close, reassign, or follow up

Write the report to .chronicle/digests/stale-actions-{{date}}.md
"#;

const TOPIC_SUMMARY_CMD: &str = r#"# Topic Summary

Summarize everything related to a specific topic.

Read .chronicle/context.md for context.
Read .chronicle/tags.json to find notes tagged with {{topic}}.
Read the processed versions of those notes from .chronicle/processed/.

Produce a topic summary:
1. **Timeline** — when this topic was discussed, in chronological order
2. **Key points** — aggregated from all notes
3. **Decisions** — what was decided about this topic
4. **Open questions** — unresolved questions across notes
5. **Action items** — all actions related to this topic
6. **People involved** — who participated in discussions

Write to .chronicle/digests/topic-{{topic}}.md
"#;

const SEED_COMMANDS: &[(&str, &str)] = &[
    ("prep-meeting.md", PREP_MEETING_CMD),
    ("weekly-review.md", WEEKLY_REVIEW_CMD),
    ("extract-decisions.md", EXTRACT_DECISIONS_CMD),
    ("find-stale-actions.md", FIND_STALE_ACTIONS_CMD),
    ("topic-summary.md", TOPIC_SUMMARY_CMD),
];

// ── Custom Workflow Commands ──

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandInfo {
    pub name: String,
    pub filename: String,
    pub description: String,
    pub params: Vec<String>,
    pub content: String,
}

/// List available commands from .chronicle/commands/
#[tauri::command]
pub async fn list_commands(workspace_path: String) -> Result<Vec<CommandInfo>, String> {
    let commands_dir = Path::new(&workspace_path)
        .join(".chronicle")
        .join("commands");
    if !commands_dir.exists() {
        return Ok(vec![]);
    }

    let mut commands = Vec::new();
    let entries = std::fs::read_dir(&commands_dir)
        .map_err(|e| format!("Failed to read commands dir: {}", e))?;

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
            .map_err(|e| format!("Failed to read command {}: {}", filename, e))?;

        let name = content
            .lines()
            .find(|l| l.starts_with("# "))
            .map(|l| l[2..].trim().to_string())
            .unwrap_or_else(|| filename.trim_end_matches(".md").replace('-', " "));

        let description = content
            .lines()
            .skip_while(|l| l.starts_with('#') || l.trim().is_empty())
            .find(|l| !l.trim().is_empty())
            .unwrap_or("")
            .trim()
            .to_string();

        let params: Vec<String> = {
            let mut found = Vec::new();
            let mut rest = content.as_str();
            while let Some(start) = rest.find("{{") {
                if let Some(end) = rest[start..].find("}}") {
                    let param = rest[start + 2..start + end].trim().to_string();
                    if !found.contains(&param) {
                        found.push(param);
                    }
                    rest = &rest[start + end + 2..];
                } else {
                    break;
                }
            }
            found
        };

        commands.push(CommandInfo {
            name,
            filename,
            description,
            params,
            content,
        });
    }

    commands.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(commands)
}

// ── Action Dashboard Commands ──

/// Read the actions.json file from .chronicle directory
#[tauri::command]
pub async fn read_actions_file(workspace_path: String) -> Result<String, String> {
    let path = Path::new(&workspace_path)
        .join(".chronicle")
        .join("actions.json");

    if !path.exists() {
        return Ok("[]".to_string());
    }

    std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read actions: {}", e))
}

/// Update a specific action item's status in actions.json
#[tauri::command]
pub async fn update_action_status(
    workspace_path: String,
    action_index: usize,
    new_status: String,
) -> Result<(), String> {
    let path = Path::new(&workspace_path)
        .join(".chronicle")
        .join("actions.json");

    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read actions: {}", e))?;

    let mut actions: Vec<Value> = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse actions: {}", e))?;

    if action_index >= actions.len() {
        return Err("Action index out of bounds".to_string());
    }

    if let Some(action) = actions.get_mut(action_index) {
        if let Some(obj) = action.as_object_mut() {
            obj.insert("status".to_string(), Value::String(new_status));
        }
    }

    let updated = serde_json::to_string_pretty(&actions)
        .map_err(|e| format!("Failed to serialize: {}", e))?;

    std::fs::write(&path, updated)
        .map_err(|e| format!("Failed to write actions: {}", e))?;

    Ok(())
}
