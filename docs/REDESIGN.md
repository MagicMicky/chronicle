# Chronicle Redesign: From Prototype to Product

## The Problem With Chronicle Today

Chronicle has good bones but feels like an engineering prototype, not a product people trust daily. After a full audit of every layer (frontend, backend, MCP server, architecture, docs), here's what's wrong and what to do about it.

---

## Part 1: What Users Actually Need

### The Real User
A single person who takes notes during meetings and captures thoughts throughout the day. They want:
- **Trust**: "My notes are saved. Period."
- **Speed**: Open, type, done. No friction.
- **Intelligence**: AI that organizes their chaos into actionable structure.
- **Recall**: Find anything they wrote, anytime.

They do NOT want:
- To understand "sessions" or "workspaces"
- To manage timers or worry about durations
- To configure MCP servers or WebSocket ports
- Multiple processing styles to choose from
- A terminal embedded in their note-taking app (unless they're a developer)

### The Real Workflow
```
1. Open app (instant - remembers last state)
2. Click "New Note" or open existing one
3. Type freely, maybe use markers (>, !, ?, [], @)
4. Notes auto-save continuously (user never thinks about it)
5. Press Cmd+Enter to process with AI
6. See structured summary appear alongside notes
7. Close note, move on with life
8. Later: search across all notes, find that thing from Tuesday
```

---

## Part 2: Architecture Problems

### Problem 1: The MCP Server Is Under-Utilized, Not Over-Engineered

**Corrected take:** Claude Code integration IS the product. MCP is the right architecture for it. The problem isn't MCP's existence — it's that:

1. The WebSocket connection is fragile (race conditions, silent push failures, no heartbeat)
2. MCP only has 5 tools — far too few for real Claude Code agent workflows
3. Processing goes through MCP but the result flow back to the UI is broken
4. There's no agent orchestration — just one-shot tool calls

**What needs to change:**

**Fix the plumbing:**
- Add WebSocket heartbeat/keepalive
- Add message queue with retry for push events
- Fix startup race condition (MCP server should wait for app connection)
- Add connection status visible in the UI

**Expand the MCP surface:**
- Add 10+ new tools for agents (tagging, searching, correlating, action tracking)
- Add resources for notes, tags, actions, digests
- Enable agent workflows: chained tool calls that run in background

**Keep processing in MCP** (it's already there and working), but fix the reliability:
- Streaming responses back to UI
- Proper error recovery
- Re-process capability

**The flow stays the same but gets reliable:**
```
User clicks Process (or agent triggers automatically)
  → Tauri IPC → WebSocket → MCP Server → Claude API
  → Streaming results back through WebSocket → Tauri events → UI
  + Message queue ensures nothing is dropped
  + Heartbeat ensures connection is alive
  + Agent orchestration chains multiple tool calls
```

### Problem 2: Session Tracking Is Confusing

**Current behavior:**
- Timer starts when you open a note
- Timer runs even when you're not typing
- Timer doesn't survive app restart
- Duration shows in status bar as "(32m)" with no context
- No pause/resume
- No idle detection

**User perception:** "What is this timer? Am I being tracked? Will something break if I don't stop it?"

**Proposed fix:**
- Remove the visible timer concept entirely
- Track edit activity silently (first edit timestamp, last edit timestamp, total active editing time)
- Show "Last edited: 5 minutes ago" instead of a running timer
- On file close, auto-commit with metadata (no user action needed)
- The "session" concept becomes internal metadata, not a UI element

### Problem 3: Workspace Management Is Overhead

**Current behavior:**
- User must "Open Workspace" to start
- Recent workspaces list takes up sidebar space
- Multiple workspace support adds complexity
- Git repo initialization on workspace open

**Reality:** Most users have ONE folder for notes. Maybe two.

**Proposed fix:**
- On first launch: ask user to pick their notes folder (or create one)
- Remember it. That's the workspace. Done.
- Remove "Recent Workspaces" UI
- Add "Change Notes Folder" in settings (rare operation)
- Auto-initialize git silently on first use

### Problem 4: The App Doesn't Feel Trustworthy

**Symptoms:**
- No persistent visual save indicator ("Saved" vs "Saving..." vs "Unsaved")
- Auto-save is silent (2s debounce, no feedback)
- No "last saved at" timestamp visible
- Pane layout resets on reload
- Last-opened file not restored on restart
- No unsaved changes warning on app close
- Console.log everywhere instead of proper error handling

**Proposed fix:**
- Persistent save indicator in status bar: checkmark + "Saved" / spinner + "Saving..." / warning + "Unable to save"
- Show "Last saved: just now" or "Last saved: 2 min ago"
- Persist ALL UI state (pane sizes, open file, scroll position) to localStorage
- Restore full state on app launch (user sees exactly what they left)
- Add proper error toast notifications (not console.log)
- Warn before closing with unsaved changes

---

## Part 3: Feature Gaps

### Critical Missing Features

#### 1. Full-Text Search (Cmd+Shift+F)
Right now there's NO way to search across notes. For a daily note-taking app, this is essential.
- Search all notes by content
- Filter by date range, tags, markers
- Results show file name + matching line + context
- Click to open at the matched line

#### 2. Tags / File Organization
Notes are flat files with dates. No way to organize or categorize.
- Support `#tags` in markdown content
- Auto-extract tags on save
- Tag-based filtering in sidebar
- AI auto-suggests tags based on content

#### 3. Daily Note Shortcut
Most note-taking happens daily. There should be a "Today's Note" button.
- One click creates/opens today's note (`2026-02-22-saturday.md`)
- Template with date header and common sections
- Quick access from sidebar or Cmd+T

#### 4. Note Linking
Notes should reference each other.
- `[[note-name]]` wiki-link syntax
- Auto-complete when typing `[[`
- Backlinks shown in sidebar or footer
- AI processing can suggest related notes

#### 5. Proper File Operations
The explorer has no context menu. You can't:
- Create a new file in a specific folder
- Rename a file
- Delete a file
- Move a file
- Create a folder

These need right-click context menus and keyboard shortcuts.

#### 6. AI Features Beyond Processing
Current AI: "process this note into sections." That's it.

What's missing:
- **Auto-tagging**: AI suggests tags based on content
- **Cross-note analysis**: "What are my open action items across all notes?"
- **Smart search**: Natural language search ("what did Sarah say about the Q3 budget?")
- **Note correlation**: AI links related notes together
- **Weekly digest**: Auto-generate summary of the week's notes
- **Follow-up tracking**: Track action items across notes, flag overdue items

### Important Missing Features

#### 7. Export
- Export processed note as PDF
- Copy structured summary to clipboard (formatted)
- Export action items to clipboard/file

#### 8. Templates
- Meeting notes template
- 1:1 template
- Daily standup template
- Custom templates

#### 9. Keyboard-First UX
Current shortcuts are minimal. Need:
- `Cmd+S` - Save now (even though auto-save exists, muscle memory)
- `Cmd+T` - Today's note
- `Cmd+Enter` - Process current note
- `Cmd+Shift+F` - Search all notes
- `Cmd+W` - Close current note
- `Cmd+1/2/3` - Switch between recent notes
- `Cmd+\` - Toggle sidebar
- `Cmd+J` - Toggle AI panel

#### 10. Better Processing UX
- Show progress as sections are generated (streaming)
- Allow re-processing with a single click
- Show diff between original and processed
- Allow editing processed output
- Remember processing history (not just latest)

---

## Part 4: UI/UX Redesign

### Current Layout Problems
- Four panes crammed together (explorer + editor + terminal + AI output)
- Terminal takes up editor space but is rarely used during note-taking
- AI output pane is empty most of the time (wasted space)
- Collapse buttons are tiny and easy to miss
- No focus mode for distraction-free writing

### Proposed Layout

```
+------------------------------------------+
| [Today] [New] [Search]    [Process] [AI] |  <- Toolbar
+--------+---------------------------------+
|        |                                 |
| Files  |        Editor                   |
| Tags   |     (full width when AI         |
| Recent |      panel is hidden)           |
|        |                                 |
|        +---------------------------------+
|        |  Status: Saved | 342 words      |
+--------+---------------------------------+
```

**When AI panel is shown (after processing):**
```
+------------------------------------------+
| [Today] [New] [Search]    [Process] [AI] |
+--------+-------------------+-------------+
|        |                   |  TL;DR      |
| Files  |    Editor         |  Key Points |
| Tags   |                   |  Actions    |
| Recent |                   |  Questions  |
|        |                   |             |
|        +-------------------+-------------+
|        |  Status: Saved | 342 words      |
+--------+---------------------------------+
```

**Key changes:**
- Terminal is HIDDEN by default (accessible via Cmd+` or bottom drawer)
- AI panel slides in from right only when there's content
- Sidebar shows files + tags + recent (not workspace management)
- Toolbar at top for primary actions
- Status bar always visible with save state + word count
- Focus mode (Cmd+Shift+F11): hides everything except editor

### Component Redesign

#### Sidebar
- **Files tab**: Tree view with file type icons, context menus
- **Tags tab**: All tags extracted from notes, click to filter
- **Recent tab**: Last 10 opened files (not workspaces)
- Resizable, collapsible with Cmd+\

#### Editor
- Full-width by default (not squeezed between 3 panes)
- Markdown toolbar (hidden by default, shown on hover at top)
- Word count in status bar
- "Last saved: just now" in status bar
- Visible save indicator
- Cmd+S works (triggers immediate save + visual feedback)

#### AI Panel
- Only appears when there's processed content
- Sections are collapsible
- Action items are persistent (saved to .meta file)
- "Re-process" button
- "Copy all" button
- Shows processing timestamp

#### Terminal (Developer Feature)
- Hidden by default
- Toggled with Cmd+` (slides up from bottom)
- Not part of the main layout
- For Claude Code integration (power users only)

---

## Part 5: Technical Fixes

### Rust Backend

| Issue | Fix |
|-------|-----|
| Atomic write leaves .tmp files on error | Add cleanup in error path |
| Fake UUID generation (time+PID) | Use `uuid` crate |
| WebSocket spawns separate tokio runtime | Use Tauri's async runtime |
| Hardcoded git signature | Read from system git config |
| Session tracker: single note only | Track HashMap of active notes |
| No idle detection | Detect inactivity, pause timer |
| Markdown section parsing is brittle | Use proper markdown parser or structured output from Claude |
| No file size in FileNode model | Add size_bytes field |
| Metadata scattered in .meta/ per folder | Centralize at workspace root |
| Console errors not surfaced to UI | Add error event system |

### MCP Server

| Issue | Fix |
|-------|-----|
| Processing engine inside MCP | Move to Rust backend, MCP becomes read-only bridge |
| sendPush() fails silently | Add message queue + retry |
| Git operations are synchronous | Use async exec |
| No streaming responses | Stream sections as they generate |
| Config loaded once at startup | Support hot-reload |
| Zero WebSocket client tests | Add reconnection + error tests |
| Duration parameter ignored in processing | Pass it through |
| No max file size validation | Add limit before reading |

### Frontend

| Issue | Fix |
|-------|-----|
| No persistent save indicator | Add to status bar |
| Pane layout not persisted | Save to localStorage |
| Last file not restored on launch | Persist + restore |
| No search functionality | Add Cmd+Shift+F global search |
| No file context menus | Add right-click menus |
| No toast notifications | Add notification system |
| Action items not persisted | Save to .meta file |
| Console.log everywhere | Replace with proper logging |
| No unsaved changes warning | Add beforeunload handler |
| Quick Open caps at 50 files | Add virtual scrolling |

---

## Part 6: Priorities (What to Build First)

### Phase 1: Trust & Reliability (1-2 weeks)
**Goal: User never worries about losing data**
1. Persistent save indicator (Saved/Saving.../Error)
2. State restoration on launch (last file, pane sizes, scroll position)
3. Unsaved changes warning on close
4. Fix atomic write cleanup
5. Fix MCP WebSocket reliability (heartbeat, message queue, startup race)
6. Remove session timer from UI (keep silent tracking)
7. Toast notification system for errors

### Phase 2: Core UX (1-2 weeks)
**Goal: App feels natural for daily note-taking**
1. Daily note shortcut (Cmd+T)
2. Full-text search (Cmd+Shift+F)
3. File context menus (new, rename, delete, move)
4. Better keyboard shortcuts (Cmd+S, Cmd+W, Cmd+Enter)
5. Simplified sidebar (files + tags + recent, no workspace management)
6. AI panel slides in only when content exists
7. Terminal hidden by default (Cmd+` to toggle)

### Phase 3: Intelligence — Claude Code as the Brain (2-3 weeks)
**Goal: Claude Code continuously organizes, tags, correlates, and surfaces insights from your notes**

Chronicle's differentiator isn't "AI summarizes your notes." Any app can do that. The differentiator is: **Claude Code lives inside your note system and works on it like a colleague.**

#### Core Principle: No API Keys, No Separate Servers — Just Claude Code

Chronicle uses the user's **existing Claude Code subscription**. No `ANTHROPIC_API_KEY`, no separate billing, no MCP server making its own API calls. The user pays for Claude Code once and Chronicle rides on it.

**The key insight:** `claude -p` (pipe/print mode) runs Claude Code non-interactively from the command line. It uses the user's subscription, can read/write files, and returns structured output. The Tauri app spawns `claude -p` processes to do AI work.

**What we're removing:**
- The entire MCP server's Claude API integration (`@anthropic-ai/sdk`)
- The WebSocket server in the Rust backend
- The WebSocket client in the MCP server
- All the plumbing between app ↔ MCP for processing

**What replaces it:**
- `claude -p` invoked from Rust via `Command::new("claude")`
- The filesystem as the communication channel (`.chronicle/` directory)
- Tauri's `notify` file watcher to detect when Claude writes results
- The existing MCP server stays ONLY as an optional config for users who want Claude Code terminal access to their notes (registered in `~/.claude.json`)

#### 3.0 Architecture: How Claude Code Integrates

```
┌─────────────────────────────────────────────────┐
│ Chronicle App (Tauri)                           │
│                                                 │
│  User clicks "Process" or app detects idle      │
│       │                                         │
│       ▼                                         │
│  Rust spawns: claude -p "process this note"     │
│    --output-format json                         │
│    --allowedTools "Read,Write,Edit,Glob,Grep"   │
│    --max-turns 5                                │
│    --append-system-prompt "..."                  │
│    --cwd /path/to/workspace                     │
│       │                                         │
│       ▼                                         │
│  Claude Code (user's subscription)              │
│  - Reads the note file                          │
│  - Reads .chronicle/state.json for context      │
│  - Processes content                            │
│  - Writes results to .chronicle/                │
│       │                                         │
│       ▼                                         │
│  App watches .chronicle/ with fs::notify        │
│  - Detects new/changed index files              │
│  - Updates UI reactively (tags, actions, etc.)  │
│                                                 │
│  Terminal (Cmd+`)                               │
│  - User can also talk to Claude Code directly   │
│  - "what are my open action items?"             │
│  - Claude reads .chronicle/ indexes + notes     │
└─────────────────────────────────────────────────┘
```

**No WebSocket. No MCP processing. No API keys. Just `claude -p` and the filesystem.**

#### 3.1 The `claude -p` Interface

**How we invoke Claude Code from Rust:**

```rust
#[tauri::command]
async fn run_claude_task(task: String, workspace: String) -> Result<String, String> {
    let output = tokio::process::Command::new("claude")
        .args(&[
            "-p", &task,
            "--output-format", "json",
            "--allowedTools", "Read,Write,Edit,Glob,Grep",
            "--max-turns", "10",
            "--cwd", &workspace,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run Claude Code: {}", e))?;

    String::from_utf8(output.stdout)
        .map_err(|e| format!("Invalid output: {}", e))
}
```

**Key flags:**
| Flag | Purpose |
|------|---------|
| `-p` | Non-interactive mode (pipe), exits when done |
| `--output-format json` | Structured JSON response for parsing |
| `--allowedTools` | Auto-approve file tools (no permission prompts) |
| `--max-turns N` | Limit work to prevent runaway |
| `--max-budget-usd N` | Spending cap per invocation |
| `--cwd` | Set working directory to workspace |
| `--append-system-prompt` | Custom instructions for the task |

**What Claude Code already has built-in:**
- `Read` — read any file
- `Write` — create files
- `Edit` — modify files
- `Glob` — find files by pattern
- `Grep` — search file contents
- `Bash` — run commands (git log, etc.)

We don't need MCP tools. Claude Code can already do everything through its native tools.

#### 3.2 Prompt Files (The "Agent" Definitions)

Instead of MCP tool schemas, we define agents as **prompt files** in `.chronicle/prompts/`:

```
.chronicle/
├── prompts/
│   ├── process.md      # "Process this note into structured sections"
│   ├── tagger.md       # "Extract tags from recently modified notes"
│   ├── correlator.md   # "Find connections between notes"
│   ├── actions.md      # "Scan notes for action items, update index"
│   └── digest.md       # "Generate summary of notes from this period"
├── state.json          # Current app state (written by Tauri)
├── tags.json           # Tag index (written by Claude)
├── actions.json        # Action items (written by Claude)
├── links.json          # Note correlations (written by Claude)
├── agent-runs.json     # Last run times per agent
└── digests/
    ├── 2026-02-22.md
    └── 2026-W08.md
```

**Example: `.chronicle/prompts/process.md`**
```markdown
You are Chronicle's note processor. Read the note at the path provided
and create a structured summary.

Read .chronicle/state.json to find the current file and workspace.

Output structure (write to .chronicle/processed/{filename}.json):
- tldr: 2-3 sentence summary
- keyPoints: array of thematic bullet points
- actionItems: array of {text, owner, done}
- questions: array of open questions
- tags: suggested tags for this note

Use the semantic markers in the note:
- > = thoughts, ! = important, ? = questions, [] = actions, @ = attributions

Write the JSON output file, then write a human-readable .md version
to .chronicle/processed/{filename}.md.
```

**Invocation:** `claude -p "$(cat .chronicle/prompts/process.md) Process: meeting-notes.md"`

#### 3.3 Background Agents

**Tagger Agent**
- Prompt: `.chronicle/prompts/tagger.md`
- Reads notes modified since last run (checks `agent-runs.json`)
- Extracts tags: people (`@sarah`), projects, themes, topics
- Writes to `.chronicle/tags.json`
- App watches file → updates sidebar Tags tab

**Correlator Agent**
- Prompt: `.chronicle/prompts/correlator.md`
- Reads `.chronicle/tags.json` to find notes with overlapping tags
- Reads note content for semantic similarity
- Writes to `.chronicle/links.json`
- App watches file → shows "Related Notes" in AI panel

**Action Tracker Agent**
- Prompt: `.chronicle/prompts/actions.md`
- Scans all notes for `[]` and `[x]` markers
- Cross-references with existing `.chronicle/actions.json`
- Detects: new items, completed items, stale items (>7 days)
- Writes updated `.chronicle/actions.json`
- App watches file → updates sidebar Actions tab

**Digest Agent**
- Prompt: `.chronicle/prompts/digest.md`
- Reads all notes from the period + action items + tags
- Generates structured summary
- Writes to `.chronicle/digests/YYYY-MM-DD.md`
- App watches folder → shows digest in sidebar

#### 3.4 Trigger Mechanism

**From the app (automatic):**
```rust
// Idle detection: no edits for 2 minutes
fn on_idle_timeout(workspace: &str) {
    // Run tagger → correlator → action tracker sequentially
    run_claude_task(read_prompt("tagger.md"), workspace).await;
    run_claude_task(read_prompt("correlator.md"), workspace).await;
    run_claude_task(read_prompt("actions.md"), workspace).await;
}

// Processing: user presses Cmd+Enter
fn on_process_note(workspace: &str, note_path: &str) {
    let prompt = format!("{} Process: {}", read_prompt("process.md"), note_path);
    run_claude_task(&prompt, workspace).await;
}
```

**From the terminal (on-demand):**
```bash
# User types directly in Chronicle's terminal:
claude "what are my open action items? check .chronicle/actions.json"
claude "summarize my meetings this week"
claude "tag all notes from today"
```

**Scheduled (digests):**
- Tauri background timer: run digest agent daily at 6pm if workspace was active
- Or: run on app launch if last digest was >24h ago

#### 3.5 Filesystem as Communication

**App → Claude Code:** `.chronicle/state.json`
```json
{
  "workspacePath": "/home/user/notes",
  "currentFile": "2026-02-22-sunday.md",
  "lastEdited": "2026-02-22T10:30:00Z",
  "noteCount": 47
}
```
Written by Tauri on every file switch. Claude Code reads it to know context.

**Claude Code → App:** Index files in `.chronicle/`
- Claude writes `tags.json`, `actions.json`, `links.json`, processed files
- Tauri watches with `notify` crate (filesystem events)
- UI updates reactively when files change

**No WebSocket. No polling. Just files.**

#### 3.6 What the UI Shows

**Sidebar additions:**
- **Tags section**: All tags with note counts, click to filter file list
- **Actions section**: Open action items across notes, grouped by note, overdue badges

**AI Panel (right side, auto-shows when content exists):**
- Processed note sections (TL;DR, Key Points, Actions, Questions)
- "Related Notes" links (from correlator)
- Tags for current note

**Status bar:**
- "Last organized: 5 min ago" (from `agent-runs.json`)
- Agent activity: "Organizing..." spinner when `claude -p` is running
- Tag count for current note

#### 3.7 The Experience

```
Morning:
1. Open Chronicle → see yesterday's digest in sidebar
2. Click "Today's Note" → template with date header
3. Join standup → type freely with markers
4. Close note → auto-save, auto-commit
5. 2 minutes idle → Claude Code runs in background:
   - Tags extracted: #standup, #api-redesign, #sarah
   - Actions indexed: "[] follow up on timeline"
   - Links found: related to Tuesday's API kickoff note
6. Tags and actions appear in sidebar (filesystem watch)

Afternoon:
1. Open Chronicle → see today's 3 notes
2. Notice "2 overdue actions" badge in sidebar
3. Click → see action items from this week with source notes
4. Open terminal: "claude summarize my meetings this week"
5. Claude reads notes directly, generates cross-note summary

Friday:
1. Open Chronicle → weekly digest waiting
2. "8 meetings, 12 actions (5 new, 3 done, 4 carried)"
3. Key themes: API redesign, Q3 planning, hiring
```

#### 3.8 What Happens to the MCP Server

**The MCP server becomes optional.** It's useful for ONE thing: letting Claude Code in the terminal discover Chronicle's data through structured resources/tools. But it's no longer required for processing.

**Keep (optional, in `~/.claude.json`):**
- `note://current` resource → reads `.chronicle/state.json`
- `note://tags` resource → reads `.chronicle/tags.json`
- Git history tools (get_history, compare_versions)
- These help Claude Code in the terminal give better answers

**Remove:**
- `@anthropic-ai/sdk` dependency (no more direct API calls)
- `process_meeting` tool (processing done via `claude -p`)
- WebSocket client (reads filesystem instead)
- All WebSocket message handling

**Remove from Rust backend:**
- WebSocket server (`websocket/` module)
- App state sharing via WebSocket
- Processing trigger via WebSocket
- MCP connection tracking

**The MCP server goes from ~1000 lines to ~200 lines.** Or we can remove it entirely and let Claude Code's native tools (Read, Glob, Grep) handle everything — the prompt files tell it where to find things.

#### 3.9 Implementation Order

1. **`.chronicle/` infrastructure** — directory structure, JSON schemas, state.json writer, filesystem watcher in Rust
2. **`claude -p` integration** — Rust command to spawn Claude Code, capture output, handle errors
3. **Process note via Claude Code** — replace MCP processing with `claude -p` + prompt file
4. **Tagger agent** — prompt file + idle trigger + tags.json + Tags UI in sidebar
5. **Action Tracker agent** — prompt file + actions.json + Actions UI in sidebar
6. **Correlator agent** — prompt file + links.json + Related Notes in AI panel
7. **Digest agent** — prompt file + scheduled trigger + digest display
8. **Remove WebSocket layer** — gut the WS server, WS client, MCP processing
9. **Simplify MCP server** — optional, filesystem-only, no SDK

### Phase 4: Polish (1 week)
**Goal: App feels professional**
1. Focus mode (Cmd+Shift+F11)
2. Templates (meeting, 1:1, standup, custom)
3. Export (PDF, clipboard)
4. Onboarding flow for first launch (pick folder, verify Claude Code installed)
5. Agent configuration (which agents run, frequency, budget limits)
6. Claude Code status in UI (installed? version? subscription active?)

---

## Part 7: What to Remove/Simplify

### Remove
- [ ] Session timer display (keep silent tracking internally)
- [ ] Recent workspaces UI (replace with single "notes folder" setting)
- [ ] Multiple processing styles in UI (use one smart style, keep API parameter for MCP)
- [ ] "Open Workspace" / "Close Workspace" buttons
- [ ] Terminal as a primary pane (move to toggleable bottom drawer)

### Simplify
- [ ] Workspace: one folder, auto-initialized, remembered forever
- [ ] Git: silent auto-commits, no user-facing git UI
- [ ] Sidebar: files + tags + actions + recent (no workspace management)
- [ ] Status bar: save state + word count + last edited (remove session duration)

### Keep & Strengthen
- [x] Marker system (>, !, ?, [], @) — Chronicle's unique capture UX
- [x] Auto-save with debounce
- [x] Git version control (silent, automatic)
- [x] Structured AI output (TL;DR, Key Points, Actions, Questions)
- [x] CodeMirror editor with markdown support
- [x] Dark/light theme
- [x] Keyboard-first design
- [x] **Terminal — where users interact with Claude Code directly**
- [x] **`claude -p` — the app invokes Claude Code using the user's subscription**
- [x] **Filesystem as communication — `.chronicle/` directory, no WebSocket**

### Remove (from current architecture)
- [ ] WebSocket server in Rust backend
- [ ] WebSocket client in MCP server
- [ ] `@anthropic-ai/sdk` in MCP server (no direct API calls)
- [ ] `process_meeting` tool (replaced by `claude -p`)
- [ ] `ANTHROPIC_API_KEY` requirement
- [ ] MCP server as required dependency (becomes optional)

---

## Part 8: Success Metrics

How do we know the redesign worked?

1. **Trust**: User never clicks "Save" manually or worries about data loss
2. **Speed**: New note to typing in < 1 second
3. **Processing**: Click to structured summary in < 5 seconds (perceived)
4. **Recall**: Find any note from any day in < 3 seconds
5. **Daily use**: App is opened every workday without friction
6. **Stability**: No crashes, no lost data, no mysterious errors

---

## Appendix: Issue Status After Phase 1 & 2

### Fixed in Phase 1
- [x] Atomic write .tmp cleanup (storage/files.rs)
- [x] Fake UUID → proper uuid crate (processing.rs)
- [x] WebSocket separate tokio runtime → Tauri's runtime (server.rs)
- [x] Push messages silently dropped → message queue (client.ts)
- [x] No save indicator → persistent save state
- [x] No state restoration → full persistence
- [x] No error surfacing → toast notification system

### Fixed in Phase 2
- [x] No file search → full-text search (Cmd+Shift+F)
- [x] No file management → context menus (rename/delete/create)
- [x] Missing keyboard shortcuts → comprehensive set
- [x] Cluttered sidebar → simplified with recent files
- [x] AI panel always visible → auto-show/hide
- [x] Terminal always visible → hidden drawer

### Being removed in Phase 3
- WebSocket server/client (replaced by filesystem communication)
- MCP server's Claude API calls (replaced by `claude -p`)
- `ANTHROPIC_API_KEY` requirement (uses Claude Code subscription)
- Processing via MCP (replaced by prompt files + `claude -p`)

### Remaining concerns
- Git commit messages not sanitized (could break format)
- Theme change rebuilds entire CodeMirror editor
- File tree re-renders on every status update
