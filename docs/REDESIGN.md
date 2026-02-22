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

### Problem 1: The MCP Server Is Over-Engineered

**Current flow (5 hops):**
```
User clicks Process
  → Svelte frontend
  → Tauri IPC
  → Rust WebSocket client sends to MCP server
  → MCP server calls Claude API
  → Response flows back through all 5 layers
```

**Why this is wrong:**
- MCP was designed for multi-client AI tool access. Chronicle has ONE client.
- The WebSocket connection between Tauri and MCP is fragile (race conditions on startup, silent push failures, no heartbeat).
- Distributing a separate TypeScript runtime (Bun/Node) alongside a Tauri app is painful.
- Debugging 5 layers of indirection for "call Claude API" is absurd.

**What MCP IS useful for:**
- Letting Claude Code (in terminal) access your notes via `note://current` resource
- Running queries like "list my action items across all notes" from CLI
- Future: letting other AI tools interact with your notes

**Proposed fix:**
- Move core AI processing INTO the Rust backend (direct Claude API call via `reqwest`)
- Keep MCP server as an OPTIONAL companion for Claude Code integration
- MCP becomes a read-only bridge, not the processing engine

**New flow (2 hops):**
```
User clicks Process
  → Tauri command calls Claude API directly
  → Response updates UI
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
5. Move AI processing to Rust backend (direct Claude API)
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

### Phase 3: Intelligence (1-2 weeks)
**Goal: AI adds real value beyond processing**
1. Auto-tagging on save
2. #tag extraction and sidebar filter
3. Cross-note action item tracking
4. Note linking with `[[wiki-links]]`
5. Streaming AI responses (show sections as they generate)
6. Processing history (not just latest)
7. Re-process button

### Phase 4: Polish (1 week)
**Goal: App feels professional**
1. Focus mode (Cmd+Shift+F11)
2. Templates (meeting, 1:1, standup)
3. Export (PDF, clipboard)
4. Weekly digest generation
5. Onboarding flow for first launch
6. MCP server as optional companion (for Claude Code users)

---

## Part 7: What to Remove/Simplify

### Remove
- [ ] Session timer display (keep silent tracking internally)
- [ ] Recent workspaces UI (replace with single "notes folder" setting)
- [ ] Multiple processing styles in UI (use one smart style, keep API parameter for MCP)
- [ ] "Open Workspace" / "Close Workspace" buttons
- [ ] Terminal as a primary pane (move to toggleable bottom drawer)

### Simplify
- [ ] Processing: direct Claude API call instead of MCP round-trip
- [ ] Workspace: one folder, auto-initialized, remembered forever
- [ ] Git: silent auto-commits, no user-facing git UI
- [ ] Sidebar: files + tags + recent (3 tabs, no workspace management)
- [ ] Status bar: save state + word count + last edited (remove session duration)

### Keep
- [x] Marker system (>, !, ?, [], @) - this is Chronicle's unique value
- [x] Auto-save with debounce
- [x] Git version control (silent, automatic)
- [x] Structured AI output (TL;DR, Key Points, Actions, Questions)
- [x] CodeMirror editor with markdown support
- [x] Dark/light theme
- [x] Keyboard-first design
- [x] MCP server (but as optional companion, not core processing engine)

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

## Appendix: File-by-File Issues Found

### Critical Bugs
- `app/src-tauri/src/websocket/server.rs`: Spawns separate tokio runtime (line ~160)
- `app/src-tauri/src/commands/processing.rs`: Fake UUID generation (line ~52)
- `app/src-tauri/src/storage/files.rs`: Atomic write doesn't clean up .tmp on error (line ~43)
- `mcp-server/src/websocket/client.ts`: `sendPush()` silently drops messages when disconnected
- `mcp-server/src/tools/process.ts`: Session duration available but not passed to prompt builder

### Security Concerns
- No symlink protection in MCP server file reads
- No max file size validation in MCP server
- WebSocket has no authentication (relies on localhost-only binding)
- Git commit messages not sanitized (could break format)

### Performance Issues
- MCP server uses `execFileSync` for git (blocks event loop)
- Theme change rebuilds entire CodeMirror editor
- File tree re-renders on every status update
- Two tokio runtimes running simultaneously
