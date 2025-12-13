# Chronicle — Product Requirements Document

## Executive Summary

Chronicle is a local-first, AI-powered notes application designed for engineering leaders who need to capture, process, and retrieve insights from high-volume note schedules. It combines fast markdown capture with Claude-powered processing to transform chaotic real-time notes into structured, actionable summaries.

## Problem Statement

Engineering leaders in various industries face a specific note-taking challenge:

1. **High note volume** — 30-50% of work time spent in notes (1:1s, syncs, cross-functional, external stakeholders)
2. **Chaotic capture** — during notes, notes mix thoughts-to-express, points-from-others, questions, and action items without structure
3. **No processing** — raw notes rarely get reviewed or transformed into actionable items
4. **Lost context** — when notes aren't searchable or structured, note insights disappear
5. **Tool friction** — existing tools either optimize for capture (too simple) or organization (too complex for real-time use)

The result: valuable note context is lost, action items slip through cracks, and preparation for follow-up notes requires reconstructing context from memory.

## Target User

**Primary persona:** Engineering leader (Head of Engineering, VP, Director) at a company (fintech, healthcare, enterprise)

**Characteristics:**
- 6-10 notes per day across varied formats
- Compliance-aware (notes may be referenced in audits)
- Technical enough to appreciate local-first architecture
- Uses terminal/CLI tools daily (Claude Code user)
- Values ownership of data over cloud convenience

**Not targeting (for MVP):**
- Individual contributors with few notes
- Users who need real-time collaboration
- Non-technical users who avoid terminals

## Core Value Proposition

Chronicle transforms note chaos into actionable clarity:

**During capture:** Fast, distraction-free capture with optional semantic markers
**After capture:** AI processing extracts structure, actions, and insights
**Over time:** Queryable knowledge base of history

## Core Features (MVP)

### F1: Four-Pane Interface

A single-window application with resizable, collapsible panes:

| Pane | Purpose | Behavior |
|------|---------|----------|
| **Explorer** (left) | Navigate note files | Tree view of workspace folder, grouped by date |
| **Editor** (center) | Raw note capture | CodeMirror-based markdown editor |
| **AI Output** (right) | Processing results | Structured view of AI analysis (not raw markdown) |
| **Terminal** (bottom) | Claude Code integration | Embedded terminal for AI commands |

### F2: Markdown Editor with Semantic Markers

Fast capture optimized for note context:

- Standard markdown support (headings, lists, bold, italic)
- Configurable semantic markers for quick categorization:
  - `>` — my thoughts / things to say
  - `!` — important points from others
  - `?` — questions / unclear items
  - `[]` — action items
  - `@name:` — attribution
- Syntax highlighting for markers
- No formatting toolbar (keyboard-driven)

### F3: Auto-Save and Auto-Naming

Zero friction file management:

- Auto-save every 2 seconds after changes
- File naming derived from first H1 heading
- Fallback to timestamp if no heading: `YYYY-MM-DD-HHmm.md`
- Automatic rename when heading changes
- No "Save As" dialogs ever

### F4: Session Tracking

Intelligent note duration inference:

- Session starts on first edit
- Session ends after 15 minutes of inactivity OR 2 hours maximum
- Post-session edits tracked as "annotations"
- Display: `● Note Name (32m) + 2 annotations`
- Session metadata stored for processing context

### F5: AI Processing via MCP Server

Claude Code integration for note transformation:

- `process_meeting` tool processes raw notes into structured output
- Processing styles: standard, brief, detailed, 1on1, audit
- Output displayed in AI Output pane (not as file replacement)
- Keyboard shortcut: `Cmd+Shift+P` triggers processing
- Terminal commands for advanced queries

### F6: AI Output Pane

Structured display of processing results (not raw markdown render):

- **TL;DR section** — 2-3 sentence summary
- **Key Points** — thematically grouped insights
- **Action Items** — extracted checklist with owners
- **Open Questions** — items needing follow-up
- Read-only for MVP (future: interactive annotations)
- Persists until next processing or file switch

### F7: Workspace-Based Storage

VS Code-style folder management:

- User selects a folder as Chronicle workspace
- Recent workspaces remembered
- File structure within workspace:
  ```
  workspace/
  ├── YYYY-MM-DD-note-name.md    # processed notes
  ├── .raw/                          # original captures
  ├── .meta/                         # structured JSON
  └── .chronicle/                    # app config
  ```

### F8: Git Version Control

Automatic version control for full history and version history:

- Workspace auto-initialized as git repo (if not already)
- Commits triggered on semantic events (not every save):
  - Session end: `session: Note Name (32m)`
  - Processing complete: `process: Note Name (audit)`
  - Annotations added: `annotate: Note Name (+2)`
  - Manual commit: `Cmd+Shift+S`
- No remote configured by default (user adds if desired)
- Full history queryable via MCP: "what changed in yesterday's audit notes?"
- Supports version control/audit requirements with immutable history

### F9: Terminal Integration

Embedded terminal for Claude Code:

- Pre-configured with workspace as working directory
- Chronicle MCP server auto-registered
- Command history preserved
- Output streams visible
- `Cmd+`` to focus terminal

## Explicitly Out of Scope (MVP)

| Feature | Reason | Future consideration |
|---------|--------|---------------------|
| Calendar integration | Requires security approval, complex OAuth | Phase 2 |
| Real-time AI suggestions | Adds latency and distraction during capture | Phase 3 |
| Cloud sync | Conflicts with local-first principle | Maybe never |
| Collaborative editing | Different product category | No |
| Mobile app | Desktop-first for note context | Phase 4 |
| Voice recording/transcription | Privacy concerns, different UX | Phase 3 |
| Search across notes | Requires indexing infrastructure | Phase 2 |
| Action item tracking | Needs persistent state management | Phase 2 |
| Note templates | Nice-to-have, not core | Phase 2 |
| Custom themes | Cosmetic | Phase 3 |
| Plugin system | Architectural complexity | Phase 4 |

## Success Metrics

### Quantitative (post-launch tracking)

| Metric | Target | Rationale |
|--------|--------|-----------|
| Notes processed per week | >20 | Validates daily use |
| Time from note end to processing | <5 min | Validates workflow integration |
| Processing completion rate | >90% | Validates AI reliability |
| App crash rate | <1/week | Stability baseline |

### Qualitative (user feedback)

- "I actually review my notes now"
- "I stopped losing action items"
- "Preparing for follow-ups is faster"
- "I trust the AI summaries"

## User Experience Principles

1. **Speed over features** — capture must never lag
2. **Keyboard-first** — mouse optional for power users
3. **Progressive disclosure** — simple by default, powerful when needed
4. **Transparency** — raw notes always accessible, AI never hides source
5. **Local ownership** — user's data stays on user's machine

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Claude API latency | Frustrating processing delays | Show progress, allow background processing |
| API costs | Unsustainable usage | Track token usage, implement caching, batch processing |
| CodeMirror complexity | Long editor development time | Use proven extensions, limit custom features |
| Cross-platform bugs | Maintenance burden | Tauri handles most, test on all platforms in CI |
| MCP server instability | Lost integration value | Comprehensive error handling, graceful degradation |

## Open Questions

1. **Offline processing** — should we support local LLM fallback when API unavailable?
2. **Note encryption** — should we offer at-rest encryption for sensitive note content?
3. **Export formats** — beyond markdown, do users need PDF/HTML export?
4. **Keyboard shortcut conflicts** — how to handle conflicts with OS/other apps?

---

*Document version: 1.0*
*Last updated: 2024-12-10*
*Status: Ready for development*