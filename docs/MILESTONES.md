# Chronicle — Milestones & Build Order

## Overview

This document outlines the recommended build sequence for Chronicle MVP. The order is designed to:
1. Validate core assumptions early
2. Build dependencies before dependents
3. Enable incremental testing
4. Deliver usable functionality at each milestone

## Milestone Summary

| Milestone | Duration | Deliverable |
|-----------|----------|-------------|
| M0: Foundation | 2-3 days | Empty Tauri app with four-pane layout |
| M1: Editor | 3-4 days | Functional markdown editor with markers |
| M2: Storage | 2-3 days | Auto-save, auto-naming, workspace |
| M3: Session | 2 days | Session tracking and duration |
| M4: Terminal | 2-3 days | Embedded terminal with PTY |
| M5: MCP Server | 3-4 days | Basic MCP server with `process_meeting` |
| M6: AI Output | 2-3 days | AI Output pane with structured display |
| M7: Integration | 2-3 days | Full flow, polish, shortcuts |
| M8: Distribution | 2 days | Cross-platform builds, installer |

**Total estimated: 20-25 days**

---

## Milestone 0: Foundation

**Goal:** Tauri app skeleton with four-pane layout working

### Tasks

```
M0.1 - Project scaffolding
├── Initialize Tauri + Svelte project
├── Set up TypeScript configuration
├── Configure Vite for Svelte
├── Add .gitignore, README
└── Verify `npm run tauri dev` launches empty window

M0.2 - Four-pane layout
├── Create App.svelte with CSS Grid layout
├── Create Panes.svelte container component
├── Create PaneHandle.svelte for resizing
├── Implement resizable panes (drag handles)
├── Store pane sizes in memory
└── Add collapse/expand for Explorer, AI Output, Terminal

M0.3 - Basic components
├── Create Explorer.svelte (placeholder)
├── Create Editor.svelte (placeholder)
├── Create AIOutput.svelte (placeholder)
├── Create Terminal.svelte (placeholder)
└── Create StatusBar.svelte (placeholder)
```

### Acceptance Criteria

- [x] Window opens with four visible panes
- [x] Panes resize via drag handles
- [x] Panes collapse with buttons/shortcuts
- [x] Layout survives window resize
- [x] Hot reload works in dev mode

### Dependencies

None (foundation)

---

## Milestone 1: Editor

**Goal:** Functional CodeMirror editor with marker highlighting

### Tasks

```
M1.1 - CodeMirror integration
├── Install CodeMirror 6 packages
├── Create Editor.svelte wrapper
├── Configure markdown language support
├── Set up dark theme
└── Bind editor content to Svelte store

M1.2 - Marker syntax highlighting
├── Create markers.ts extension
├── Define decoration for each marker type
├── Parse lines for marker prefixes
├── Apply decorations to matching lines
└── Make marker config reactive (for future customization)

M1.3 - Editor polish
├── Configure font (JetBrains Mono)
├── Add soft wrap
├── Add basic keyboard shortcuts (bold, italic)
├── Handle focus management
└── Connect to note store
```

### Acceptance Criteria

- [ ] Editor displays markdown with syntax highlighting
- [ ] Lines starting with `>`, `!`, `?`, `[]`, `@` are highlighted distinctly
- [ ] Typing feels instant (no lag)
- [ ] Editor content accessible from Svelte store
- [ ] Editor resizes properly with pane

### Dependencies

- M0: Pane layout exists

---

## Milestone 2: Storage

**Goal:** Files saved automatically, named from heading, version controlled

### Tasks

```
M2.1 - Workspace management
├── Create Rust storage module
├── Implement open_workspace command
├── Implement list_files command (recursive)
├── Create workspace store (frontend)
├── Add folder picker dialog
└── Store recent workspaces

M2.2 - Git initialization
├── Add git2 crate
├── Create git module (Rust)
├── Auto-init repo on workspace open
├── Create default .gitignore
├── Initial commit on new workspace
└── Handle existing git repos gracefully

M2.3 - File explorer
├── Create FileTree.svelte (recursive)
├── Create FileNode.svelte
├── Display files grouped by date
├── Handle file click → open in editor
├── Highlight current file
├── Hide hidden folders
└── Collapse/expand folders

M2.4 - Auto-save
├── Create autosave.rs module
├── Implement debounced write (2s)
├── Track dirty state
├── Update status bar ("Saving...", "Saved")
├── Save on window close
└── Atomic file writes (temp → rename)

M2.5 - Auto-naming
├── Create naming.rs module
├── Parse first H1 heading
├── Generate slug from heading
├── Rename file on heading change
├── Handle filename conflicts
└── Update explorer after rename
```

### Acceptance Criteria

- [ ] User can open a folder as workspace
- [ ] Workspace auto-initialized as git repo
- [ ] Explorer shows files from workspace
- [ ] Click file to open in editor
- [ ] Edits auto-saved after 2s pause
- [ ] Files renamed when H1 changes
- [ ] Status bar shows save state

### Dependencies

- M1: Editor content accessible

---

## Milestone 3: Session Tracking

**Goal:** Note duration tracked automatically

### Tasks

```
M3.1 - Session state machine
├── Create session module (Rust)
├── Define session states: Inactive, Active, Ended
├── Track session start time
├── Track last edit time
├── Implement 15-min inactivity timeout
├── Implement 2-hour maximum

M3.2 - Frontend session display
├── Create session store
├── Display elapsed time in status bar
├── Update every minute
├── Show final duration after session ends
├── Track annotation count

M3.3 - Session persistence
├── Save session data to .meta/ JSON
├── Load session on file open
├── Preserve session after app restart
└── Handle session edge cases

M3.4 - Auto-commit on session events
├── Commit on session end
├── Commit on annotation threshold (debounced)
├── Generate semantic commit messages
├── Stage relevant files per event
└── Manual commit shortcut (Cmd+Shift+S)
```

### Acceptance Criteria

- [ ] Status bar shows "Note Name (5m)" during active session
- [ ] Session ends after 15 min inactivity
- [ ] Session ends after 2 hours max
- [ ] Post-session edits are "annotations"
- [ ] Status shows "Note Name (32m) + 2 annotations"
- [ ] Git commit created on session end
- [ ] Commit message follows semantic format

### Dependencies

- M2: Auto-save exists, file tracking works

---

## Milestone 4: Terminal Integration

**Goal:** Embedded terminal running in workspace

### Tasks

```
M4.1 - PTY spawning
├── Add portable-pty crate
├── Create pty module (Rust)
├── Spawn shell process
├── Configure working directory
├── Stream stdout/stderr to frontend

M4.2 - xterm.js integration
├── Install xterm.js packages
├── Create Terminal.svelte wrapper
├── Configure theme to match app
├── Handle input → PTY write
├── Handle PTY output → display
├── Implement resize handling

M4.3 - Terminal polish
├── Add fit addon (auto-resize)
├── Add web-links addon (clickable URLs)
├── Configure scrollback
├── Handle Cmd+` focus shortcut
├── Preserve terminal across pane collapse
└── Clean up PTY on close
```

### Acceptance Criteria

- [ ] Terminal pane shows working shell
- [ ] Commands execute and output displays
- [ ] Working directory is workspace root
- [ ] Terminal resizes with pane
- [ ] `Cmd+`` focuses terminal
- [ ] Can type `claude` and get Claude Code

### Dependencies

- M2: Workspace path available

---

## Milestone 5: MCP Server

**Goal:** Basic MCP server with `process_meeting` tool

### Tasks

```
M5.1 - MCP server scaffold
├── Initialize Bun project
├── Install MCP SDK
├── Create basic server entry point
├── Register with stdio transport
├── Verify Claude Code sees server

M5.2 - WebSocket client
├── Create WebSocket client to Chronicle app
├── Implement getCurrentFile request
├── Handle reconnection
├── Create message types

M5.3 - Resources
├── Implement note://current
├── Implement note://config
├── Read files from workspace
└── Return as MCP resources

M5.4 - process_meeting tool
├── Define tool schema
├── Implement marker parsing
├── Build Claude prompt
├── Call Anthropic API
├── Parse response
├── Write processed output
├── Push result via WebSocket

M5.5 - Rust WebSocket server
├── Add tokio-tungstenite to app
├── Create WebSocket server module
├── Handle MCP server connections
├── Implement getCurrentFile handler
├── Handle processingComplete push
└── Update AI Output store on push

M5.6 - Git history tools
├── Implement get_history tool
├── Implement get_version tool
├── Implement compare_versions tool
├── Query git log from MCP server
└── Return formatted history/diffs
```

### Acceptance Criteria

- [ ] `claude "process current note"` works
- [ ] MCP server connects to Chronicle app
- [ ] Current file content accessible to MCP
- [ ] Processing calls Claude API
- [ ] Processed output written to files
- [ ] Result pushed to app
- [ ] Git commit created after processing
- [ ] `claude "show history for this note"` works

### Dependencies

- M2: File reading/writing works
- M4: Terminal available for Claude Code

---

## Milestone 6: AI Output Pane

**Goal:** Structured display of processing results

### Tasks

```
M6.1 - AI Output store
├── Create aiOutput store
├── Handle processingComplete events
├── Parse structured result
├── Track processing state
└── Handle errors

M6.2 - AI Output components
├── Create AIOutput.svelte container
├── Create Summary.svelte (TL;DR)
├── Create KeyPoints.svelte
├── Create ActionList.svelte
├── Create Questions.svelte
├── Style all components

M6.3 - State management
├── Show "Ready to process" when no result
├── Show progress during processing
├── Display result after completion
├── Show error state
├── Clear on file change
└── "View Raw" toggle
```

### Acceptance Criteria

- [ ] AI Output pane shows structured sections
- [ ] TL;DR prominent at top
- [ ] Action items as checklist
- [ ] Questions as bullet list
- [ ] Progress indicator during processing
- [ ] Error display on failure

### Dependencies

- M5: MCP server pushes results

---

## Milestone 7: Integration & Polish

**Goal:** Full workflow, keyboard shortcuts, edge cases

### Tasks

```
M7.1 - Keyboard shortcuts
├── Cmd+N: New note
├── Cmd+Shift+P: Process current
├── Cmd+B: Toggle explorer
├── Cmd+Shift+A: Toggle AI Output
├── Cmd+`: Focus terminal
├── Cmd+Shift+E: End session
└── Document all shortcuts

M7.2 - Processing button
├── Add process button to status bar
├── Style dropdown (for selecting style)
├── Connect to MCP trigger
└── Disable during processing

M7.3 - Edge case handling
├── Handle large files
├── Handle rapid typing
├── Handle network failures
├── Handle API errors
├── Handle corrupt files
├── Test concurrent saves

M7.4 - Configuration
├── Create config loader (Rust)
├── Implement config.yaml parsing
├── Apply editor settings
├── Apply marker config
├── Apply session settings
└── Hot-reload config changes
```

### Acceptance Criteria

- [ ] All keyboard shortcuts work
- [ ] Processing triggered via shortcut and button
- [ ] App handles errors gracefully
- [ ] Configuration changes apply
- [ ] No data loss in edge cases

### Dependencies

- M5-M6: Core functionality complete

---

## Milestone 8: Distribution

**Goal:** Installable builds for all platforms

### Tasks

```
M8.1 - Build configuration
├── Configure app icons
├── Configure bundle identifiers
├── Set up code signing (macOS)
├── Configure installer options
└── Test debug vs release builds

M8.2 - Platform builds
├── Build macOS DMG (arm64, x64)
├── Build Windows MSI
├── Build Linux AppImage
├── Test installation on each platform
└── Test first-run experience

M8.3 - MCP server distribution
├── Bundle MCP server with app
├── Or: document manual installation
├── Create setup instructions
└── Test Claude Code registration

M8.4 - Documentation
├── Write installation guide
├── Write user guide
├── Document keyboard shortcuts
├── Create troubleshooting guide
└── Update README
```

### Acceptance Criteria

- [ ] DMG installs on macOS
- [ ] MSI installs on Windows
- [ ] AppImage runs on Linux
- [ ] MCP server works after install
- [ ] Documentation complete

### Dependencies

- M7: App feature-complete

---

## Dependency Graph

```
M0 (Foundation)
 │
 ├─► M1 (Editor)
 │    │
 │    └─► M2 (Storage)
 │         │
 │         ├─► M3 (Session)
 │         │
 │         └─► M4 (Terminal)
 │              │
 │              └─► M5 (MCP Server)
 │                   │
 │                   └─► M6 (AI Output)
 │                        │
 │                        └─► M7 (Integration)
 │                             │
 │                             └─► M8 (Distribution)
```

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| CodeMirror complexity | Use proven examples, limit customization |
| PTY cross-platform issues | Use portable-pty, test early on all OS |
| MCP SDK changes | Pin version, document known issues |
| Claude API costs | Track tokens, implement caching |
| Scope creep | Strict adherence to MVP scope |

## Post-MVP Backlog

Features explicitly deferred:

1. **Calendar integration** — Auto-create note files from calendar
2. **Search** — Full-text search across all notes
3. **Action tracking** — Mark actions done, track across notes
4. **Templates** — Note type templates
5. **Inline AI suggestions** — Real-time assistance during capture
6. **Interactive AI Output** — Check off actions, add annotations
7. **Voice transcription** — Audio recording with transcription
8. **Mobile companion** — Quick capture on mobile
9. **Export** — PDF/HTML export of processed notes
10. **Encryption** — At-rest encryption for sensitive notes

---

*Document version: 1.0*
*Last updated: 2024-12-10*