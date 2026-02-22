# Chronicle — Potential Improvements

Improvement ideas informed by real-world Claude Code non-coding workflows, user patterns observed in the knowledge management / meeting productivity space, and Chronicle's existing architecture.

Organized by feature area. Each entry includes rationale, inspiration sources, a rough scope estimate, and implementation notes.

---

## Table of Contents

1. [Workspace Memory & Compounding Context](#1-workspace-memory--compounding-context)
2. [Cross-Note Intelligence](#2-cross-note-intelligence)
3. [Digests & Rollups](#3-digests--rollups)
4. [Audio & Transcript Ingestion](#4-audio--transcript-ingestion)
5. [Custom Workflow Commands](#5-custom-workflow-commands)
6. [Search & Retrieval](#6-search--retrieval)
7. [Action Item Intelligence](#7-action-item-intelligence)
8. [Processing Transparency](#8-processing-transparency)
9. [Calendar Integration](#9-calendar-integration)
10. [Export & Sharing](#10-export--sharing)

---

## 1. Workspace Memory & Compounding Context

### Problem

Every note processing run starts from scratch. Claude has no memory of who `@sarah` is, what projects are active, or what terminology the user prefers. Users with 50+ notes shouldn't have to re-explain context every time.

### Proposal

Introduce a **workspace context file** (`.chronicle/context.md`) that accumulates knowledge across sessions. The file is read by every processing and tagging prompt, giving Claude persistent context about:

- **People directory** — names, roles, relationships (`Sarah Chen — Staff Engineer, API team, reports to you`)
- **Active projects** — name, status, key stakeholders (`Project Atlas — Q2 migration, led by Marcus`)
- **Recurring meetings** — format, cadence, typical attendees (`Monday standup — eng team, 15 min`)
- **Terminology** — domain-specific terms, acronyms (`PSR = Production Support Review`)
- **User preferences** — summary style, level of detail, how to handle ambiguity

### Behavior

1. **Auto-discovery**: After processing, the tagger/processor agent appends newly discovered people, projects, and terms to `context.md` if they don't already exist
2. **Manual editing**: Users can open and edit `context.md` directly to correct or enrich entries
3. **Prompt injection**: Every agent prompt reads `context.md` and uses it to resolve ambiguity (e.g., "John" → `person:john-martinez` because context knows there's only one John)
4. **Compounding value**: Each processing run gets smarter as the context file grows. A note mentioning `@sarah` in month 3 automatically gets richer extraction than the same note in month 1

### Inspiration

- **Matt Stockton** transformed Claude Code into a consulting documentation system by accumulating client context in CLAUDE.md files. He emphasizes "the more I use it, the more I build better processes and patterns that compound on each other."
- **Remember.md** maintains a `Persona.md` that learns working patterns over time.
- **Obsidian + Claude Code PKM** users manually maintain "people pages" and "project pages" that Claude references.

### Scope

Low-medium. Mostly prompt engineering + a new file + UI for viewing/editing it.

### Implementation Notes

- Add `context.md` to `.chronicle/` directory (created by `init_chronicle_dir`)
- Seed with a commented-out template showing the expected structure
- Update `PROCESS_PROMPT`, `TAGGER_PROMPT`, and `ACTIONS_PROMPT` to read `.chronicle/context.md` before processing
- Add a "Workspace Context" item in the Explorer or a dedicated settings/context panel
- Agent prompts should append new discoveries in a `<!-- Auto-discovered -->` section so users can distinguish manual vs auto entries
- Git-versioned alongside everything else, so context history is preserved

---

## 2. Cross-Note Intelligence

### Problem

Notes are processed individually. A user discussing the "API redesign" across 6 meetings has no way to see the arc of that conversation — what was decided, what changed, who was involved across all notes. The links store exists but is underutilized.

### Proposal

Build a **knowledge graph layer** that connects notes by shared entities (people, topics, projects, decisions). Enable queries like:

- "Show me everything involving Sarah about the API redesign"
- "What decisions have been made about Project Atlas?"
- "When did we last discuss the budget?"

### Components

#### 2a. Entity Extraction & Linking

When processing a note, extract structured entities beyond just tags:

```json
{
  "entities": {
    "people": [{ "name": "Sarah Chen", "role": "discussed API timeline" }],
    "decisions": [{ "text": "Go with GraphQL over REST", "participants": ["sarah", "marcus"] }],
    "topics": ["api-redesign", "graphql-migration"],
    "references": ["2026-02-15-planning.md"]
  }
}
```

Store in `.chronicle/entities/` as per-note JSON files.

#### 2b. Automatic Cross-Referencing

After processing, the links agent scans for:
- Shared people across notes → link them
- Shared topics → link them
- Explicit references (`@see last Tuesday's standup`) → resolve and link
- Temporal proximity + topic overlap → suggest links

Update `.chronicle/links.json` with weighted relationships.

#### 2c. Knowledge View UI

A new panel or modal that shows:
- Entity timeline (all mentions of `person:sarah` sorted by date)
- Topic arc (how a topic evolved across multiple notes)
- Decision log (all decisions extracted across notes, with source links)

### Inspiration

- **COG (Cognition + Obsidian + Git)** builds a self-evolving knowledge graph from markdown files
- **Remember.md** auto-organizes into People, Projects, Decisions, Tasks, and Journal entries
- **Obsidian's graph view** is the most-requested feature in every PKM tool

### Scope

Medium-large. Entity extraction is a prompt change; the knowledge view UI is new.

### Implementation Notes

- Extend processed output schema to include `entities` alongside `tldr`, `keyPoints`, etc.
- Add an `entities/` subdirectory in `.chronicle/` for per-note entity files
- Enrich the existing links agent to weight links by entity overlap
- UI: Start with a simple "Related Notes" expansion — show *why* notes are related (shared person, shared topic, shared decision) not just that they are
- Future: Full graph visualization is a stretch goal; start with filtered list views

---

## 3. Digests & Rollups

### Problem

Users accumulate notes daily but never get a birds-eye view. After a week of meetings, there's no summary of "what happened this week" or "what's still open."

### Proposal

Add a **digest agent** that generates periodic rollups:

- **Daily digest**: "Today you had 4 meetings. 3 action items were created, 1 completed. Key topics: API timeline, Q2 hiring, budget review."
- **Weekly digest**: "This week: 12 meetings across 3 projects. 8 open actions (2 overdue). Recurring themes: GraphQL migration, team capacity. Decisions made: [list]."
- **Person digest**: "Your last 5 interactions with Sarah: [summary]. Open items between you: [list]."
- **Project digest**: "Project Atlas this month: 8 meetings, 14 action items (9 done). Key decisions: [list]. Unresolved questions: [list]."

### Behavior

1. **Triggered on demand**: User clicks "Generate weekly digest" from Explorer or status bar
2. **Triggered by schedule**: Optional — auto-generate at end of day/week (if the app is open)
3. **Output**: Written to `.chronicle/digests/` as markdown files, also displayed in AI Output panel
4. **Input**: Reads all processed notes within the time range + `.chronicle/context.md` for entity resolution

### Inspiration

- **COG** generates self-evolving summaries that compound over time
- **Matt Stockton** describes the "compounding value" pattern: each summary builds on prior summaries
- Multiple Claude Code users describe building "weekly review" slash commands that aggregate across files

### Scope

Medium. New agent prompt + digest storage + UI for triggering/viewing.

### Implementation Notes

- New prompt file: `.chronicle/prompts/digest.md`
- New Rust command: `generate_digest { workspacePath, range: "daily" | "weekly" | "monthly" | "custom", from?: date, to?: date }`
- Digest reads all `.chronicle/processed/*.json` within the date range
- Store output in `.chronicle/digests/2026-02-22-weekly.md` (or `.json`)
- UI: Add "Digests" section in Explorer below Tags/Actions, or a dedicated digest view in AI Output
- Could reuse the existing `claude -p` processing pipeline — just a different prompt

---

## 4. Audio & Transcript Ingestion

### Problem

The most common non-coding Claude Code workflow is: record meeting → transcribe → process. Chronicle handles step 3 well but users must capture and transcribe externally, then manually paste content.

### Proposal

Add a **transcript ingestion pipeline**:

#### 4a. Paste Transcript Mode

- A "Paste Transcript" button or keyboard shortcut that opens a modal
- User pastes a raw transcript (from Otter, Granola, Teams, Zoom, etc.)
- Chronicle wraps it in a new note with metadata header and runs processing immediately
- The raw transcript is preserved; the processed output goes to AI Output

#### 4b. Audio Recording (Stretch)

- Record button in the status bar captures audio via system microphone
- On stop: save `.wav` to `.chronicle/recordings/`
- Transcribe via local Whisper model (if available) or external service
- Create a new note from the transcription and process it

#### 4c. File Drop

- Drag an audio file (`.mp3`, `.wav`, `.m4a`) or transcript file (`.txt`, `.vtt`, `.srt`) onto Chronicle
- Auto-detect format, parse, create note, process

### Inspiration

- **Multiple meeting workflow posts** describe this exact pipeline as the #1 productivity gain
- **Dedicated Claude Code meeting skill** exists specifically for transcript → structured notes
- **Matt Stockton** reduces 30-minute post-meeting processing to 5 minutes with a similar pipeline

### Scope

4a (paste): Low. Just a modal + note creation + auto-process trigger.
4b (recording): High. Requires audio capture, Whisper integration, platform-specific microphone access.
4c (file drop): Medium. File type detection, parser for VTT/SRT, drag-and-drop handling.

### Implementation Notes

- Start with 4a (paste transcript) — highest value-to-effort ratio
- Add a "meeting transcript" template in `.chronicle/templates/transcript.md` with metadata fields (date, attendees, duration)
- The paste modal could auto-detect speaker labels (`Speaker 1:`, `[Sarah]:`) and convert to Chronicle's `@` markers
- For 4b, Tauri supports system audio via plugins; Whisper.cpp could run locally for transcription
- For 4c, register file drop handlers in Tauri window config

---

## 5. Custom Workflow Commands

### Problem

Users have recurring workflows: "prep for 1:1 with Sarah", "extract all decisions from this week", "summarize the API discussion thread." Currently these require typing custom prompts each time.

### Proposal

Let users define **custom commands** as prompt templates in `.chronicle/commands/`:

```markdown
<!-- .chronicle/commands/prep-meeting.md -->
# Prep for Meeting

Read the context about {{person}} from .chronicle/context.md.
Find the last 3 notes that mention {{person}}.
Summarize:
1. Open action items between us
2. Topics we discussed recently
3. Decisions pending their input

Output as a prep brief I can review before the meeting.
```

### Behavior

1. **Discovery**: Chronicle scans `.chronicle/commands/` for `.md` files on workspace open
2. **Invocation**: Command palette (Cmd+Shift+P) shows available commands, or a dedicated "Commands" section in Explorer
3. **Parameters**: `{{placeholders}}` prompt the user for input before execution
4. **Execution**: Runs via `claude -p` with the prompt, targeting the current workspace
5. **Output**: Displayed in AI Output panel, optionally saved to a file

### Built-in Seed Commands

Ship with useful defaults that users can customize:

| Command | Description |
|---------|-------------|
| `prep-meeting.md` | Pre-meeting brief for a person |
| `weekly-review.md` | Summarize the week's notes |
| `extract-decisions.md` | Pull all decisions from recent notes |
| `find-stale-actions.md` | Find action items older than 7 days |
| `topic-summary.md` | Summarize all notes about a topic |

### Inspiration

- **Casey Newton** built custom writing workflows as Claude Code slash commands (`.claude/commands/`)
- **Claude Code's `/commands` pattern** is well-established and understood by users
- **AI Maker** describes building an "AI agent operating system" with specialized sub-agents triggered by commands

### Scope

Low-medium. File-based commands, simple parameter substitution, execution via existing `claude -p` pipeline.

### Implementation Notes

- Scan `.chronicle/commands/` on workspace open, expose as a list in the frontend
- New Rust command: `list_commands { workspacePath }` → returns `[{ name, description, params }]`
- Parse `{{param}}` placeholders from file content, prompt user before execution
- Execute using existing `process_note`-like pipeline but with custom prompt
- Add "Commands" to the command palette (Cmd+Shift+P could show both files and commands)
- Default commands created by `init_chronicle_dir` (like templates)

---

## 6. Search & Retrieval

### Problem

As workspaces grow beyond 20-30 notes, finding specific information becomes difficult. "When did we discuss the Q2 budget?" requires manually scanning files. The current file tree and tag filtering help but don't support content-level queries.

### Proposal

Add **full-text search** with semantic awareness:

#### 6a. Full-Text Search

- Index all note content and processed output
- Search modal (Cmd+Shift+F already exists) returns ranked results with highlighted snippets
- Filter by date range, tags, people

#### 6b. Semantic Search (Stretch)

- Generate embeddings for notes (or note chunks) on processing
- Store in a local vector index (SQLite with vector extension, or simple cosine similarity on JSON)
- Query: "What did Sarah say about the API timeline?" returns relevant paragraphs across notes
- Hybrid ranking: keyword match + semantic similarity

#### 6c. Searchable Archive View

- A dedicated view showing all processed notes as a timeline
- Filter by tag, person, project, date range
- Each entry shows: date, title, TL;DR, tags, action count
- Click to open the note or jump to the processed output

### Inspiration

- **Casey Newton** built a searchable archive of 818 articles in 30 minutes using Claude Code — "something I had wanted for years but never had the technical ability to build"
- **Every app PKM discussion** emphasizes search as the bridge between capture and retrieval
- **Obsidian's search** is considered table-stakes for any knowledge management tool

### Scope

6a: Medium. Needs a search index (could use Rust `tantivy` crate or SQLite FTS5).
6b: High. Needs embedding generation + vector storage + query pipeline.
6c: Low-medium. Mostly frontend, reads from existing processed files.

### Implementation Notes

- Start with 6c (archive view) — reads existing `.chronicle/processed/*.json`, no indexing needed
- 6a: Use SQLite FTS5 via Tauri's existing SQLite plugin, index on save/process
- 6b: Generate embeddings via Claude API (batch, on processing) or local model; store in `.chronicle/embeddings/`
- Existing `SearchModal.svelte` could be extended for all three modes
- Consider a `Cmd+K` quick-query: type a question, get an answer synthesized from notes (uses search + Claude)

---

## 7. Action Item Intelligence

### Problem

Action items are tracked per-note but lack lifecycle management. Users can't easily answer: "What's overdue?", "What did I commit to this week?", "What's Sarah waiting on from me?"

### Proposal

Enhance action tracking with:

#### 7a. Global Action Dashboard

- Status bar shows global count: `3 open · 1 overdue`
- Click opens a dashboard showing all actions across notes
- Group by: owner, status, source note, age
- Filter by: person, project, date range

#### 7b. Action Lifecycle

- Actions auto-transition: `open` → `stale` (after 7 days) → user marks `done` or `dropped`
- When a note is re-processed, actions are reconciled: new ones added, completed ones marked
- Cross-note dedup: if the same action appears in multiple notes, link them

#### 7c. Owner-Based Views

- "What is Sarah waiting on from me?" → filter actions where owner=me, mentioned person=sarah
- "What did I assign to others this week?" → filter actions where owner≠me
- Requires workspace context (from feature #1) to know who "me" is

#### 7d. Action Reminders

- Optional: surface overdue actions when opening Chronicle
- Optional: include overdue actions in the daily digest prompt

### Inspiration

- **Remember.md** auto-organizes into Tasks as a first-class entity
- Multiple Claude Code productivity users describe building custom action trackers
- The existing actions store and Explorer section provide the foundation

### Scope

7a: Low. Mostly UI — data already exists in `.chronicle/actions.json`.
7b: Medium. Needs reconciliation logic in the actions agent.
7c: Medium. Depends on workspace context (feature #1).
7d: Low. Conditional UI on app open.

### Implementation Notes

- 7a: Expand the existing Actions section in Explorer, or add a dedicated Actions modal
- Status bar already shows session info — add action count
- 7b: Update `ACTIONS_PROMPT` to read previous actions and reconcile (mark done if `[x]` found, keep open if still `[]`)
- 7c: Requires `.chronicle/context.md` to identify "me" and map names to people
- Action items should reference their source note + line number for one-click navigation

---

## 8. Processing Transparency

### Problem

Users don't trust AI output they can't verify. When the AI says "Key decision: move to GraphQL," users want to see *where* in their raw notes that came from. This builds trust and catches errors.

### Proposal

Add a **"What Changed" view** showing how AI extracted its output:

#### 8a. Source Attribution

Each extracted item (key point, action, decision) links back to the source line(s) in the raw note:

```
Key Point: "Team agreed to move API to GraphQL"
  ← Line 47: "! everyone agreed GraphQL is the way to go"
  ← Line 52: "> I think this settles the REST vs GraphQL debate"
```

#### 8b. Diff View

After processing, show a side-by-side or inline view:
- Left: raw note with highlighted regions that contributed to each extraction
- Right: processed output with links back to source

#### 8c. Confidence Indicators

For each extracted item, show a subtle confidence indicator:
- High: directly from a marker (`!`, `[]`, `?`)
- Medium: inferred from context
- Low: ambiguous or uncertain

### Inspiration

- **Casey Newton's** "tools that improve my thinking, rather than substitute for it" — transparency is how you achieve this
- **AI explainability** is a growing demand across all AI tools
- Multiple users mention trust as a barrier to adopting AI note processing

### Scope

8a: Medium. Requires the processor to output source line references alongside each extraction.
8b: Medium-high. Requires a new UI component for side-by-side view.
8c: Low. Just metadata in the processed output.

### Implementation Notes

- Update `PROCESS_PROMPT` to include source line numbers with each extraction:
  ```json
  {
    "keyPoints": [
      { "text": "Move to GraphQL", "sourceLines": [47, 52] }
    ]
  }
  ```
- Store in existing `.chronicle/processed/*.json` schema (backward compatible — add optional `sourceLines`)
- UI: Clicking a key point or action in AI Output scrolls the editor to the source line and briefly highlights it
- Diff view: Could reuse CodeMirror's diff extension for side-by-side display

---

## 9. Calendar Integration

### Problem

Users have meetings on their calendar but manually create notes for each one. Pre-populating note files from calendar events (with attendees, time, agenda) saves time and improves metadata quality.

### Proposal

#### 9a. Calendar-Aware Note Creation

- Read calendar events from a local `.ics` file, CalDAV server, or OS calendar API
- Before a meeting, auto-create a note from the appropriate template with pre-filled metadata:
  ```markdown
  # Meeting: API Design Review

  **Date:** February 22, 2026
  **Attendees:** @sarah @marcus @alex
  **Duration:** 30 min

  ## Notes

  ## Action Items
  ```
- Notification: "Your API Design Review starts in 5 min. Note ready."

#### 9b. Meeting Schedule View

- Show today's meetings in the Explorer sidebar
- Each meeting links to its note (or creates one on click)
- After the meeting, show "Process" button inline

### Inspiration

- **Calendar integration** is #1 on the post-MVP backlog in `MILESTONES.md`
- Meeting-heavy users (the target persona) live in their calendar — bridging it to Chronicle reduces friction
- Several Claude Code productivity posts describe building calendar → notes pipelines

### Scope

9a: Medium-high. Calendar API access varies by platform (macOS Calendar.app, Google Calendar API, `.ics` files).
9b: Low-medium. If calendar data is available, the UI is straightforward.

### Implementation Notes

- Start with `.ics` file import (most universal, works offline)
- Tauri can read local files; user points Chronicle at an exported `.ics` or a synced calendar file
- Parse events with a Rust `.ics` parser crate (`ical`)
- Map attendees to people in `.chronicle/context.md`
- Auto-select template based on meeting title keywords (contains "1:1" → one-on-one template, contains "standup" → standup template)
- Platform-specific calendar access (macOS EventKit, etc.) is a stretch goal

---

## 10. Export & Sharing

### Problem

Processed notes are locked inside Chronicle. Users need to share meeting summaries with teammates, include action items in project trackers, or archive notes in other systems.

### Proposal

#### 10a. Copy/Export Formats

- Copy as Markdown (already implemented)
- Copy as plain text (stripped formatting)
- Export as HTML (styled, self-contained)
- Export as PDF
- Export action items as checklist (for pasting into Slack, Linear, Jira, etc.)

#### 10b. Selective Export

- Export just action items (grouped by owner)
- Export just decisions
- Export a date range of digests
- Export person-specific summary ("Everything about Sarah for the last month")

#### 10c. Integration Hooks

- Webhook on processing complete (POST structured JSON to a URL)
- Clipboard-friendly action item format for project management tools
- Optional: Slack/email integration for sharing summaries

### Inspiration

- **Lenny Rachitsky's newsletter** highlights non-technical users sharing AI-processed outputs with teams
- **Every.to** describes using Claude Code to generate formatted reports for stakeholders
- Multiple users describe the gap between "I processed my notes" and "my team benefits from it"

### Scope

10a: Low. Markdown copy exists; HTML/PDF export via existing libraries.
10b: Medium. Needs filtered queries over processed data.
10c: Medium-high. Webhook infrastructure + external service integration.

### Implementation Notes

- HTML export: Convert processed markdown to styled HTML using a template
- PDF export: Use Tauri's print-to-PDF capability or a Rust PDF library
- Action item export: Format as `- [ ] Action text (@owner)` for universal compatibility
- Webhook: Simple POST from Rust on processing complete, configurable URL in workspace settings
- Start with 10a (copy/export buttons in AI Output panel — Copy Summary already exists, extend with format options)

---

## Priority Matrix

Suggested implementation order based on value-to-effort ratio and alignment with Chronicle's core vision:

### High Value, Low Effort (Do First)

| # | Feature | Why |
|---|---------|-----|
| 1 | Workspace Memory (`context.md`) | Multiplies value of every other AI feature. Mostly prompt changes. |
| 5 | Custom Workflow Commands | Reuses existing `claude -p` pipeline. Makes Chronicle extensible without code changes. |
| 7a | Global Action Dashboard | Data already exists. Pure UI improvement with high daily utility. |
| 4a | Paste Transcript Mode | Single modal + auto-process. Addresses the #1 reported workflow. |

### High Value, Medium Effort (Do Next)

| # | Feature | Why |
|---|---------|-----|
| 3 | Digests & Rollups | New agent, but reuses existing processing pipeline. High "wow" factor. |
| 6c | Searchable Archive View | Reads existing processed files. No indexing needed. |
| 8a | Source Attribution | Prompt change + UI links. Builds trust, the key adoption barrier. |
| 2a | Entity Extraction | Prompt change + new storage. Foundation for cross-note features. |

### High Value, High Effort (Plan Carefully)

| # | Feature | Why |
|---|---------|-----|
| 6a | Full-Text Search | Needs search index. Table-stakes for 50+ note workspaces. |
| 2c | Knowledge View | New UI panel. Requires entities (2a) and links to be solid first. |
| 9a | Calendar Integration | Platform-specific. High friction reduction for target persona. |
| 4b | Audio Recording | Requires audio capture + transcription. Highest impact if achievable. |

### Lower Priority (Backlog)

| # | Feature | Why |
|---|---------|-----|
| 6b | Semantic Search | Needs embeddings. Valuable but full-text search covers 80% of cases. |
| 8b | Diff View | Nice-to-have. Source attribution (8a) delivers most of the trust value. |
| 10c | Integration Hooks | External dependencies. Defer until core experience is polished. |

---

## References

Sources that informed these suggestions:

- [How Claude Code Became My Knowledge Management System — Matt Stockton](https://mattstockton.com/2025/09/19/how-claude-code-became-my-knowledge-management-system.html)
- [Claude Code for Writers — Casey Newton / Platformer](https://www.platformer.news/claude-code-for-writers-tips-ideas/)
- [Everyone Should Be Using Claude Code More — Lenny Rachitsky](https://www.lennysnewsletter.com/p/everyone-should-be-using-claude-code)
- [How to Use Claude Code for Everyday Tasks — Every.to](https://every.to/source-code/how-to-use-claude-code-for-everyday-tasks-no-programming-required)
- [Claude Code for Scientists — Patrick Mineault](https://www.neuroai.science/p/claude-code-for-scientists)
- [Remember.md — AI-powered second brain](https://github.com/remember-md/remember)
- [COG — Cognition + Obsidian + Git](https://github.com/huytieu/COG-second-brain)
- [Claudesidian — Obsidian AI second brain](https://github.com/heyitsnoah/claudesidian)
- [Obsidian + Claude Code PKM Starter Kit](https://github.com/ballred/obsidian-claude-pkm)
- [Claude Code Meeting Transcript Skill](https://claude-plugins.dev/skills/@dgalarza/claude-code-workflows/process-meeting-transcript)
- [Claude Code Is Not a Coding Tool — Art of Saience](https://newsletter.artofsaience.com/p/claude-code-is-not-a-coding-toolits)
- [Claude Code Without the Code — Nate's Newsletter](https://natesnewsletter.substack.com/p/claude-code-without-the-code-the)

---

*Document version: 1.0*
*Created: 2026-02-22*
*Last updated: 2026-02-22*
