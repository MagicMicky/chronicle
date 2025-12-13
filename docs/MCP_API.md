# Chronicle — MCP Server API Contracts

## Overview

The Chronicle MCP server provides Claude Code with access to notes and processing capabilities. It uses the Model Context Protocol (MCP) with stdio transport and communicates with the Chronicle app via local WebSocket for real-time updates.

## Server Configuration

### MCP Registration

Claude Code configuration (`~/.config/claude-code/mcp.json` or similar):

```json
{
  "mcpServers": {
    "chronicle": {
      "command": "bun",
      "args": ["run", "/path/to/chronicle-mcp/src/index.ts"],
      "env": {
        "ANTHROPIC_API_KEY": "${ANTHROPIC_API_KEY}",
        "CHRONICLE_WORKSPACE": "${CHRONICLE_WORKSPACE}",
        "CHRONICLE_WS_PORT": "9847"
      }
    }
  }
}
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes | - | Claude API key for processing |
| `CHRONICLE_WORKSPACE` | No | `~/Documents/Chronicle` | Default workspace path |
| `CHRONICLE_WS_PORT` | No | `9847` | WebSocket port for app communication |

## Resources

Resources provide read-only access to note data.

### `note://current`

The currently open note in Chronicle app.

**URI:** `note://current`

**Returns:**
```typescript
{
  uri: "note://current",
  name: "Current Note",
  description: "The note currently open in Chronicle",
  mimeType: "text/markdown",
  text: string  // Full markdown content
}
```

**Error cases:**
- No Chronicle app connected: Returns error with message
- No file open: Returns error suggesting user open a file

---

### `note://file/{path}`

Specific note by relative path within workspace.

**URI:** `note://file/2024-12-10-project-kickoff.md`

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `path` | string | Relative path from workspace root |

**Returns:**
```typescript
{
  uri: "note://file/2024-12-10-project-kickoff.md",
  name: "2024-12-10-project-kickoff.md",
  description: "Notes from December 10, 2024",
  mimeType: "text/markdown",
  text: string
}
```

---

### `note://today`

All notes from today.

**URI:** `note://today`

**Returns:**
```typescript
{
  uri: "note://today",
  name: "Today's Notes",
  description: "All notes from today (2024-12-10)",
  mimeType: "application/json",
  text: JSON.stringify({
    date: "2024-12-10",
    notes: [
      {
        filename: "2024-12-10-project-kickoff.md",
        title: "Project Kickoff",
        duration_minutes: 32,
        processed: true,
      },
      {
        filename: "2024-12-10-brainstorm.md",
        title: "Brainstorm Session",
        duration_minutes: 28,
        processed: false,
        summary: null
      }
    ]
  })
}
```

---

### `note://recent`

Notes from the last 7 days.

**URI:** `note://recent`

**Returns:** Same structure as `note://today` but with `days` array instead of single `date`.

---

### `note://config`

Current marker configuration and settings.

**URI:** `note://config`

**Returns:**
```typescript
{
  uri: "note://config",
  name: "Chronicle Configuration",
  description: "Current marker syntax and processing settings",
  mimeType: "application/json",
  text: JSON.stringify({
    markers: {
      thought: ">",
      important: "!",
      question: "?",
      action: "[]",
      attribution: "@"
    },
    processing: {
      default_style: "standard"
    }
  })
}
```

## Tools

Tools provide actions Claude Code can invoke.

### `process_meeting`

Process raw notes into structured summary.

**Name:** `process_meeting`

**Description:** Process raw notes into a structured, actionable summary with TL;DR, key points, action items, and open questions.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "path": {
      "type": "string",
      "description": "Path to note file relative to workspace, or 'current' for the active file"
    },
    "style": {
      "type": "string",
      "enum": ["standard", "brief", "detailed", "focused", "structured"],
      "default": "standard",
      "description": "Processing style to use"
    },
    "focus": {
      "type": "string",
      "description": "Optional specific aspect to emphasize (e.g., 'action items only', 'version control gaps')"
    }
  },
  "required": ["path"]
}
```

**Example calls:**
```
process_meeting({ path: "current" })
process_meeting({ path: "current", style: "structured" })
process_meeting({ path: "2024-12-10-project-kickoff.md", style: "brief" })
process_meeting({ path: "current", focus: "version control gaps" })
```

**Output:**
```typescript
{
  content: [
    {
      type: "text",
      text: "Processed note: Project Kickoff\n\n✓ Generated summary\n✓ Extracted 3 action items\n✓ Identified 2 open questions\n\nResults displayed in Chronicle AI Output pane."
    }
  ]
}
```

**Side effects:**
1. Writes processed markdown to the `.md` file (updates it)
2. Writes structured data to `.meta/{filename}.json`
3. Preserves original to `.raw/{filename}.raw.md` (if not already saved)
4. Sends WebSocket message to Chronicle app to update AI Output pane

**Processing flow:**

```
1. Resolve path
   ├── "current" → Query Chronicle app via WebSocket
   └── relative path → Resolve from workspace root

2. Read content
   ├── Load raw markdown
   └── Load marker config

3. Parse markers
   ├── Extract thoughts (>)
   ├── Extract important points (!)
   ├── Extract questions (?)
   ├── Extract action items ([])
   └── Extract attributions (@name:)

4. Build prompt
   ├── System prompt (processing instructions)
   ├── Raw notes content
   ├── Parsed marker hints
   └── Style-specific instructions

5. Call Claude API
   └── anthropic.messages.create()

6. Parse response
   ├── Extract TL;DR section
   ├── Extract key points
   ├── Extract action items with owners
   └── Extract questions

7. Write outputs
   ├── Update .md file with processed content
   ├── Write .meta JSON with structured data
   └── Push update to Chronicle via WebSocket
```

---

### `list_notes`

List available notes with filtering.

**Name:** `list_notes`

**Description:** List notes in the workspace, optionally filtered by date range or search term.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "date_from": {
      "type": "string",
      "format": "date",
      "description": "Start date (YYYY-MM-DD)"
    },
    "date_to": {
      "type": "string",
      "format": "date",
      "description": "End date (YYYY-MM-DD)"
    },
    "search": {
      "type": "string",
      "description": "Search term to filter by title or content"
    },
    "processed_only": {
      "type": "boolean",
      "default": false,
      "description": "Only return notes that have been processed"
    },
    "limit": {
      "type": "number",
      "default": 20,
      "description": "Maximum number of results"
    }
  }
}
```

**Example calls:**
```
list_notes({})
list_notes({ date_from: "2024-12-01" })
list_notes({ search: "structured", processed_only: true })
```

**Output:**
```typescript
{
  content: [
    {
      type: "text",
      text: "Found 5 notes:\n\n1. 2024-12-10-project-kickoff.md - Project Kickoff (32m) ✓\n2. 2024-12-10-brainstorm.md - Brainstorm Session (28m)\n3. ..."
    }
  ]
}
```

---

### `get_actions`

Extract all open action items across notes.

**Name:** `get_actions`

**Description:** Get all open action items from processed notes, optionally filtered by owner or date.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "owner": {
      "type": "string",
      "description": "Filter by owner (use 'self' or 'me' for your items)"
    },
    "date_from": {
      "type": "string",
      "format": "date",
      "description": "Only actions from notes after this date"
    },
    "include_done": {
      "type": "boolean",
      "default": false,
      "description": "Include completed action items"
    }
  }
}
```

**Example calls:**
```
get_actions({})
get_actions({ owner: "self" })
get_actions({ date_from: "2024-12-01", include_done: true })
```

**Output:**
```typescript
{
  content: [
    {
      type: "text",
      text: "Open action items (8 total):\n\nFrom Project Kickoff (Dec 10):\n- [ ] Set up evidence automation (urgent)\n- [ ] Check IAM status with Sarah\n\nFrom Research Notes (Dec 9):\n- [ ] Review PR #234\n..."
    }
  ]
}
```

---

### `get_history`

Get git history for a note file.

**Name:** `get_history`

**Description:** Get version history for a note file, showing all commits that modified it.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "path": {
      "type": "string",
      "description": "Relative path to note file, or 'current'"
    },
    "limit": {
      "type": "number",
      "default": 10,
      "description": "Maximum number of commits to return"
    }
  },
  "required": ["path"]
}
```

**Example calls:**
```
get_history({ path: "current" })
get_history({ path: "2024-12-10-project-kickoff.md", limit: 5 })
```

**Output:**
```typescript
{
  content: [
    {
      type: "text",
      text: "History for 2024-12-10-project-kickoff.md:\n\n1. annotate: Project Kickoff (+2) — 3h ago\n2. process: Project Kickoff (structured) — 3h ago\n3. session: Project Kickoff (32m) — 3h ago\n\nUse get_version to view a specific version."
    }
  ]
}
```

---

### `get_version`

Get a specific historical version of a note file.

**Name:** `get_version`

**Description:** Retrieve the content of a note file at a specific commit.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "path": {
      "type": "string",
      "description": "Relative path to note file"
    },
    "commit": {
      "type": "string",
      "description": "Commit hash (short or full) or relative ref (HEAD~1, HEAD~2)"
    }
  },
  "required": ["path", "commit"]
}
```

**Example calls:**
```
get_version({ path: "2024-12-10-project-kickoff.md", commit: "HEAD~1" })
get_version({ path: "2024-12-10-project-kickoff.md", commit: "abc123" })
```

**Output:**
```typescript
{
  content: [
    {
      type: "text",
      text: "Version from commit abc123 (session: Project Kickoff (32m)):\n\n# Project Kickoff\n\n> need to push back on timeline..."
    }
  ]
}
```

---

### `compare_versions`

Compare two versions of a note file.

**Name:** `compare_versions`

**Description:** Show the diff between two versions of a note file.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "path": {
      "type": "string",
      "description": "Relative path to note file"
    },
    "from_commit": {
      "type": "string",
      "description": "Starting commit (older)",
      "default": "HEAD~1"
    },
    "to_commit": {
      "type": "string",
      "description": "Ending commit (newer)",
      "default": "HEAD"
    }
  },
  "required": ["path"]
}
```

**Example calls:**
```
compare_versions({ path: "2024-12-10-project-kickoff.md" })
compare_versions({ path: "2024-12-10-project-kickoff.md", from_commit: "HEAD~2", to_commit: "HEAD" })
```

---

### `write_processed`

Manually write processed output (used internally, but exposed for advanced use).

**Name:** `write_processed`

**Description:** Write processed content to a note file. Typically called internally by process_meeting.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "path": {
      "type": "string",
      "description": "Relative path to note file"
    },
    "content": {
      "type": "string",
      "description": "Processed markdown content"
    },
    "meta": {
      "type": "object",
      "description": "Structured metadata to write to .meta JSON"
    }
  },
  "required": ["path", "content"]
}
```

## Prompts

Reusable prompt templates for different note types.

### `process-standard`

**Name:** `process-standard`

**Description:** Standard note processing prompt

**Arguments:**
```json
{
  "notes": {
    "type": "string",
    "description": "Raw notes",
    "required": true
  },
  "duration": {
    "type": "number",
    "description": "Note duration in minutes"
  }
}
```

**Template:**
```
You are processing notes for an engineering leader at a company.

## Context
- Note duration: {{duration}} minutes
- Marker syntax:
  - `>` = their thoughts/things to say
  - `!` = important points from others
  - `?` = questions/unclear items
  - `[]` = action items
  - `@name:` = attribution

## Raw Notes
{{notes}}

## Your Task
Transform these notes into a structured summary:

1. **TL;DR** (2-3 sentences) — main topic and key takeaway
2. **Key Points** — important items discussed, grouped thematically
3. **Action Items** — as checklist with owner if identifiable
4. **Open Questions** — items needing follow-up

Be concise. Prioritize actionability. Output in markdown.
```

---

### `process-focused`

**Name:** `process-focused`

**Description:** Processing prompt optimized for 1:1 notes

**Additional focus:** Career development, feedback, relationship building, personal topics.

---

### `process-structured`

**Name:** `process-structured`

**Description:** Processing prompt optimized for structured/version control notes

**Additional focus:** Evidence gaps, timelines, regulatory requirements, remediation items.

## WebSocket Protocol

Communication between MCP server and Chronicle app.

### Connection

- **URL:** `ws://localhost:{CHRONICLE_WS_PORT}`
- **Protocol:** JSON messages
- **Initiated by:** MCP server connects to Chronicle app's WebSocket server

### Message Types

#### Request: Get Current File

```json
{
  "type": "request",
  "id": "req-001",
  "method": "getCurrentFile"
}
```

#### Response: Current File

```json
{
  "type": "response",
  "id": "req-001",
  "result": {
    "path": "/Users/mickael/notes/2024-12-10-project-kickoff.md",
    "relativePath": "2024-12-10-project-kickoff.md",
    "content": "# Project Kickoff\n\n> need to push back...",
    "session": {
      "startedAt": "2024-12-10T14:00:00Z",
      "durationMinutes": 32,
      "isActive": false
    }
  }
}
```

#### Push: Processing Complete

```json
{
  "type": "push",
  "event": "processingComplete",
  "data": {
    "path": "2024-12-10-project-kickoff.md",
    "result": {
      "keyPoints": ["Change management gaps flagged", "Weekly exports required"],
      "actionItems": [
        { "text": "Set up evidence automation", "owner": "self", "urgent": false }
      ],
      "questions": ["IAM rollout timeline?"]
    }
  }
}
```

#### Push: Processing Error

```json
{
  "type": "push",
  "event": "processingError",
  "data": {
    "path": "2024-12-10-project-kickoff.md",
    "error": "Claude API rate limited. Retry in 60 seconds."
  }
}
```

## Error Handling

### MCP Error Responses

All tools return errors in MCP-standard format:

```typescript
{
  content: [
    {
      type: "text",
      text: "Error: [error message]"
    }
  ],
  isError: true
}
```

### Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `FILE_NOT_FOUND` | Requested note file doesn't exist | Check path, list available files |
| `NO_WORKSPACE` | No workspace configured | Set CHRONICLE_WORKSPACE or open folder in app |
| `APP_NOT_CONNECTED` | Chronicle app not running or WebSocket disconnected | Start app, check port |
| `API_ERROR` | Claude API request failed | Check API key, retry |
| `RATE_LIMITED` | Claude API rate limit hit | Wait and retry |
| `PARSE_ERROR` | Failed to parse note file | Check file format |

---

*Document version: 1.0*
*Last updated: 2024-12-10*