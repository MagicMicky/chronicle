# Chronicle — Data Models & Schema

## Overview

Chronicle uses a file-based storage model with no database. All data is stored as files in the user's workspace directory. This document defines the structure of those files and the in-memory data models used by the application.

## File System Structure

```
workspace/                              # User-selected folder (git repo)
├── .git/                              # Git repository (auto-initialized)
├── .gitignore                         # Chronicle default ignores
├── 2024-12-10-project-kickoff.md           # Processed notes (tracked)
├── 2024-12-10-brainstorm.md
├── 2024-12-09-research-notes.md
│
├── .raw/                               # Original unprocessed captures (tracked)
│   ├── 2024-12-10-project-kickoff.raw.md
│   ├── 2024-12-10-brainstorm.raw.md
│   └── 2024-12-09-research-notes.raw.md
│
├── .meta/                              # Structured metadata (tracked)
│   ├── 2024-12-10-project-kickoff.json
│   ├── 2024-12-10-brainstorm.json
│   └── 2024-12-09-research-notes.json
│
└── .chronicle/                         # App configuration (tracked)
    ├── config.yaml                     # User preferences
    └── state.json                      # UI state (git-ignored)
```

### Default .gitignore

```gitignore
# Chronicle app state (not content)
.chronicle/state.json

# OS files
.DS_Store
Thumbs.db

# Editor backups
*~
*.swp
*.swo

# Temporary files
*.tmp
*.temp
```

### Git Commit Conventions

Chronicle uses semantic commit messages for automatic version control:

```
{type}: {title} ({detail})
```

| Type | Trigger | Example |
|------|---------|---------|
| `init` | Workspace initialization | `init: Chronicle workspace` |
| `session` | Session ends | `session: Project Kickoff (32m)` |
| `process` | AI processing completes | `process: Project Kickoff (structured)` |
| `annotate` | Post-session edits | `annotate: Project Kickoff (+3)` |
| `snapshot` | Manual commit | `snapshot: Project Kickoff` |

**Files staged per commit type:**

| Type | Files Staged |
|------|--------------|
| `init` | `.gitignore`, `.chronicle/config.yaml` |
| `session` | `{note}.md`, `.meta/{note}.json` |
| `process` | `{note}.md`, `.raw/{note}.raw.md`, `.meta/{note}.json` |
| `annotate` | `{note}.md`, `.meta/{note}.json` |
| `snapshot` | All modified note files |

## File Formats

### Note Note File (`.md`)

Primary file the user sees and edits. After processing, this contains the enhanced version.

```markdown
# Project Kickoff

## TL;DR

weekly exports. IAM rollout timeline is blocking.

## Key Points


## Action Items

- [ ] Check IAM rollout status with Sarah — **owner: me, urgent**
- [ ] Get version control matrix ETA — **owner: Michael**

## Open Questions

- What's the realistic timeline for IAM rollout?

---

## Raw Notes

> need to push back on the timeline


? check with Sarah on the IAM status

[] set up evidence automation

! gap identified in change mgmt documentation


@ Michael: version control matrix ETA?
```

### Raw Note File (`.raw.md`)

Preserved original capture, never modified after session ends.

```markdown
# Project Kickoff

> need to push back on the timeline


? check with Sarah on the IAM status

[] set up evidence automation

! gap identified in change mgmt documentation


@ Michael: version control matrix ETA?
```

### Metadata File (`.json`)

Structured data extracted during processing. Enables future features like search and action tracking.

```json
{
  "id": "structured-sync-2024-12-10-1400",
  "version": 1,
  
  "file": {
    "name": "2024-12-10-project-kickoff.md",
    "raw_path": ".raw/2024-12-10-project-kickoff.raw.md",
    "created_at": "2024-12-10T14:00:00Z",
    "updated_at": "2024-12-10T14:35:00Z"
  },
  
  "session": {
    "started_at": "2024-12-10T14:00:00Z",
    "ended_at": "2024-12-10T14:32:00Z",
    "duration_minutes": 32,
    "annotation_count": 0,
    "last_annotation_at": null
  },
  
  "processing": {
    "processed_at": "2024-12-10T14:35:00Z",
    "style": "structured",
    "model": "claude-sonnet-4-20250514",
    "tokens_used": {
      "input": 1250,
      "output": 890
    }
  },
  
  "extracted": {
    "title": "Project Kickoff",
    
    "action_items": [
      {
        "id": "action-001",
        "owner": "self",
        "status": "open",
        "urgent": false,
        "created_at": "2024-12-10T14:35:00Z"
      },
      {
        "id": "action-002",
        "text": "Check IAM rollout status with Sarah",
        "owner": "self",
        "status": "open",
        "urgent": true,
        "created_at": "2024-12-10T14:35:00Z"
      },
      {
        "id": "action-003",
        "text": "Get version control matrix ETA",
        "owner": "Michael",
        "status": "open",
        "urgent": false,
        "created_at": "2024-12-10T14:35:00Z"
      }
    ],
    
    "questions": [
      "What's the realistic timeline for IAM rollout?",
    ],
    
    "people_mentioned": ["Sarah", "Michael"],
    
    
    "markers_found": {
      "thoughts": 2,
      "important": 2,
      "questions": 1,
      "actions": 1,
      "attributions": 1
    }
  }
}
```

### Config File (`config.yaml`)

User preferences and marker definitions.

```yaml
# Chronicle Configuration
version: 1

# Semantic markers for note categorization
markers:
  thought: ">"          # My thoughts / things to say
  important: "!"        # Important points from others
  question: "?"         # Questions / unclear items
  action: "[]"          # Action items
  attribution: "@"      # @name: attribution

# Session tracking
session:
  inactivity_timeout_minutes: 15
  max_duration_minutes: 120

# Auto-save behavior
autosave:
  enabled: true
  debounce_ms: 2000

# Editor preferences
editor:
  font_family: "JetBrains Mono, monospace"
  font_size: 14
  line_height: 1.6
  theme: "dark"         # dark | light
  vim_mode: false

# AI processing defaults
processing:
  default_style: "standard"   # standard | brief | detailed | focused | structured
  auto_process: false         # Auto-process when session ends

# Terminal
terminal:
  shell: null                 # null = system default
  font_size: 13
```

### App State File (`state.json`)

Persisted UI state across sessions.

```json
{
  "version": 1,
  "window": {
    "width": 1400,
    "height": 900,
    "x": 100,
    "y": 100,
    "maximized": false
  },
  "panes": {
    "explorer_width": 200,
    "ai_output_width": 350,
    "terminal_height": 200,
    "explorer_collapsed": false,
    "ai_output_collapsed": false,
    "terminal_collapsed": false
  },
  "last_opened_file": "2024-12-10-project-kickoff.md",
  "recent_files": [
    "2024-12-10-project-kickoff.md",
    "2024-12-10-brainstorm.md",
    "2024-12-09-research-notes.md"
  ]
}
```

### Recent Workspaces File (`recent-workspaces.json`)

```json
{
  "version": 1,
  "workspaces": [
    {
      "path": "/Users/mickael/Documents/notes",
      "name": "Work Notes",
      "last_opened": "2024-12-10T14:00:00Z"
    },
    {
      "path": "/Users/mickael/Documents/personal-notes",
      "name": "Personal",
      "last_opened": "2024-12-08T10:00:00Z"
    }
  ]
}
```

## In-Memory Data Models

### TypeScript Interfaces (Frontend)

```typescript
// Core note representation
interface Note {
  id: string;
  filename: string;
  title: string;
  content: string;
  rawContent: string;
  session: NoteSession;
  meta: NoteMeta | null;
  isDirty: boolean;
}

interface NoteSession {
  startedAt: Date;
  endedAt: Date | null;
  durationMinutes: number;
  annotationCount: number;
  lastAnnotationAt: Date | null;
  isActive: boolean;
}

interface NoteMeta {
  processedAt: Date;
  style: ProcessingStyle;
  summary: string;
  actionItems: ActionItem[];
  questions: string[];
  peopleMentioned: string[];
  topics: string[];
}

interface ActionItem {
  id: string;
  text: string;
  owner: string;
  status: 'open' | 'done';
  urgent: boolean;
}

type ProcessingStyle = 'standard' | 'brief' | 'detailed' | 'focused' | 'structured';

// File tree representation
interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  note?: NoteMeta;  // For files with processed metadata
}

// AI Output display
interface AIOutput {
  noteId: string;
  processedAt: Date;
  tldr: string;
  keyPoints: string[];
  actionItems: ActionItem[];
  questions: string[];
  rawNotesSection: string;
}

// App configuration
interface AppConfig {
  markers: MarkerConfig;
  session: SessionConfig;
  autosave: AutosaveConfig;
  editor: EditorConfig;
  processing: ProcessingConfig;
  terminal: TerminalConfig;
}

interface MarkerConfig {
  thought: string;
  important: string;
  question: string;
  action: string;
  attribution: string;
}

interface SessionConfig {
  inactivityTimeoutMinutes: number;
  maxDurationMinutes: number;
}

// Git history
interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  type: 'init' | 'session' | 'process' | 'annotate' | 'snapshot';
  timestamp: Date;
  filesChanged: string[];
}

interface GitHistory {
  path: string;
  commits: GitCommit[];
}
```

### Rust Structs (Backend)

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub filename: String,
    pub title: String,
    pub content: String,
    pub session: NoteSession,
    pub is_dirty: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteSession {
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub duration_minutes: u32,
    pub annotation_count: u32,
    pub last_annotation_at: Option<DateTime<Utc>>,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteMeta {
    pub id: String,
    pub version: u32,
    pub file: FileMeta,
    pub session: SessionMeta,
    pub processing: Option<ProcessingMeta>,
    pub extracted: Option<ExtractedData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMeta {
    pub name: String,
    pub raw_path: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMeta {
    pub started_at: DateTime<Utc>,
    pub ended_at: DateTime<Utc>,
    pub duration_minutes: u32,
    pub annotation_count: u32,
    pub last_annotation_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessingMeta {
    pub processed_at: DateTime<Utc>,
    pub style: String,
    pub model: String,
    pub tokens_used: TokenUsage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenUsage {
    pub input: u32,
    pub output: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedData {
    pub title: String,
    pub summary: String,
    pub action_items: Vec<ActionItem>,
    pub questions: Vec<String>,
    pub people_mentioned: Vec<String>,
    pub topics: Vec<String>,
    pub markers_found: MarkerCounts,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionItem {
    pub id: String,
    pub text: String,
    pub owner: String,
    pub status: ActionStatus,
    pub urgent: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ActionStatus {
    Open,
    Done,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarkerCounts {
    pub thoughts: u32,
    pub important: u32,
    pub questions: u32,
    pub actions: u32,
    pub attributions: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub version: u32,
    pub markers: MarkerConfig,
    pub session: SessionConfig,
    pub autosave: AutosaveConfig,
    pub editor: EditorConfig,
    pub processing: ProcessingConfig,
    pub terminal: TerminalConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarkerConfig {
    pub thought: String,
    pub important: String,
    pub question: String,
    pub action: String,
    pub attribution: String,
}

// Git types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitCommit {
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub commit_type: CommitType,
    pub timestamp: DateTime<Utc>,
    pub files_changed: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CommitType {
    Init,
    Session,
    Process,
    Annotate,
    Snapshot,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHistory {
    pub path: String,
    pub commits: Vec<GitCommit>,
}

// Additional config structs...
```

## AI Model Input/Output

### Processing Input (to Claude API)

```typescript
interface ProcessingInput {
  system: string;           // System prompt with instructions
  messages: Message[];      // User message with notes content
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Constructed prompt content
interface PromptContext {
  rawNotes: string;
  duration: number;
  markers: MarkerConfig;
  parsedMarkers: ParsedMarkers;
  style: ProcessingStyle;
  focus?: string;
}

interface ParsedMarkers {
  thoughts: string[];
  important: string[];
  questions: string[];
  actions: string[];
  attributions: Attribution[];
}

interface Attribution {
  person: string;
  said: string;
}
```

### Processing Output (from Claude API)

The Claude API returns markdown which is then parsed:

```typescript
interface ProcessingOutput {
  tldr: string;
  keyPoints: string[];
  actionItems: ParsedActionItem[];
  questions: string[];
  rawMarkdown: string;     // Full response for display
}

interface ParsedActionItem {
  text: string;
  owner: string | null;
  urgent: boolean;
}
```

## Data Flow Summary

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   User       │───►│   Editor     │───►│   Storage    │
│   Input      │    │   State      │    │   Manager    │
└──────────────┘    └──────────────┘    └──────┬───────┘
                                               │
                           ┌───────────────────┼───────────────────┐
                           │                   │                   │
                           ▼                   ▼                   ▼
                    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
                    │  .md file    │    │ .raw.md file │    │  .json file  │
                    │  (primary)   │    │  (backup)    │    │  (metadata)  │
                    └──────────────┘    └──────────────┘    └──────────────┘
                           │
                           │ (on process command)
                           ▼
                    ┌──────────────┐
                    │  MCP Server  │
                    │  + Claude    │
                    └──────┬───────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │ Update .md   │ │ Update .json │ │ Push to App  │
    │ with summary │ │ with extract │ │ via WebSocket│
    └──────────────┘ └──────────────┘ └──────────────┘
```

---

*Document version: 1.0*
*Last updated: 2024-12-10*