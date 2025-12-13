# Chronicle — Project Structure

## Repository Layout

```
chronicle/
│
├── README.md                           # Project overview, quick start
├── LICENSE                             # MIT or similar
├── .gitignore
├── .editorconfig
│
├── docs/                               # Documentation
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── DATA_MODELS.md
│   ├── MCP_API.md
│   └── CONTRIBUTING.md
│
├── app/                                # Tauri application
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── svelte.config.js
│   │
│   ├── src/                            # Svelte frontend
│   │   ├── main.ts                     # Entry point
│   │   ├── App.svelte                  # Root component, layout
│   │   ├── app.css                     # Global styles
│   │   │
│   │   ├── lib/                        # Components
│   │   │   ├── layout/
│   │   │   │   ├── Panes.svelte        # Resizable pane container
│   │   │   │   ├── PaneHandle.svelte   # Resize handles
│   │   │   │   └── StatusBar.svelte    # Bottom status bar
│   │   │   │
│   │   │   ├── explorer/
│   │   │   │   ├── Explorer.svelte     # File tree container
│   │   │   │   ├── FileTree.svelte     # Recursive tree component
│   │   │   │   └── FileNode.svelte     # Individual file/folder
│   │   │   │
│   │   │   ├── editor/
│   │   │   │   ├── Editor.svelte       # CodeMirror wrapper
│   │   │   │   ├── extensions.ts       # CM extensions config
│   │   │   │   ├── markers.ts          # Marker highlighting
│   │   │   │   └── theme.ts            # Editor theme
│   │   │   │
│   │   │   ├── ai-output/
│   │   │   │   ├── AIOutput.svelte     # AI results container
│   │   │   │   ├── Summary.svelte      # TL;DR section
│   │   │   │   ├── ActionList.svelte   # Action items display
│   │   │   │   ├── Questions.svelte    # Open questions
│   │   │   │   └── KeyPoints.svelte    # Key points section
│   │   │   │
│   │   │   ├── terminal/
│   │   │   │   ├── Terminal.svelte     # xterm.js wrapper
│   │   │   │   └── pty.ts              # PTY communication
│   │   │   │
│   │   │   └── common/
│   │   │       ├── Button.svelte
│   │   │       ├── Icon.svelte
│   │   │       └── Tooltip.svelte
│   │   │
│   │   ├── stores/                     # Svelte stores (state)
│   │   │   ├── workspace.ts            # Workspace/files state
│   │   │   ├── note.ts              # Current note state
│   │   │   ├── session.ts              # Session tracking
│   │   │   ├── aiOutput.ts             # AI results state
│   │   │   ├── config.ts               # App configuration
│   │   │   └── ui.ts                   # UI state (pane sizes, etc.)
│   │   │
│   │   ├── utils/                      # Frontend utilities
│   │   │   ├── tauri.ts                # Tauri IPC helpers
│   │   │   ├── markdown.ts             # Markdown parsing
│   │   │   ├── date.ts                 # Date formatting
│   │   │   └── shortcuts.ts            # Keyboard shortcuts
│   │   │
│   │   └── types/                      # TypeScript types
│   │       ├── note.ts
│   │       ├── config.ts
│   │       └── ipc.ts                  # Tauri command types
│   │
│   ├── src-tauri/                      # Rust backend
│   │   ├── Cargo.toml
│   │   ├── Cargo.lock
│   │   ├── tauri.conf.json             # Tauri configuration
│   │   ├── build.rs
│   │   ├── icons/                      # App icons
│   │   │
│   │   └── src/
│   │       ├── main.rs                 # Entry point
│   │       ├── lib.rs                  # Library root
│   │       │
│   │       ├── commands/               # Tauri command handlers
│   │       │   ├── mod.rs
│   │       │   ├── file.rs             # File operations
│   │       │   ├── workspace.rs        # Workspace management
│   │       │   ├── session.rs          # Session tracking
│   │       │   ├── config.rs           # Configuration
│   │       │   └── process.rs          # Trigger processing
│   │       │
│   │       ├── storage/                # File system operations
│   │       │   ├── mod.rs
│   │       │   ├── files.rs            # Read/write files
│   │       │   ├── workspace.rs        # Workspace structure
│   │       │   ├── autosave.rs         # Auto-save logic
│   │       │   └── naming.rs           # Auto-naming logic
│   │       │
│   │       ├── session/                # Session tracking
│   │       │   ├── mod.rs
│   │       │   ├── tracker.rs          # Session state machine
│   │       │   └── duration.rs         # Duration calculation
│   │       │
│   │       ├── git/                    # Git version control
│   │       │   ├── mod.rs
│   │       │   ├── repo.rs             # Repository init/management
│   │       │   ├── commits.rs          # Auto-commit logic
│   │       │   └── history.rs          # History queries
│   │       │
│   │       ├── pty/                    # Terminal management
│   │       │   ├── mod.rs
│   │       │   ├── spawn.rs            # PTY spawning
│   │       │   └── io.rs               # I/O streaming
│   │       │
│   │       ├── websocket/              # WebSocket server
│   │       │   ├── mod.rs
│   │       │   ├── server.rs           # WS server
│   │       │   └── handlers.rs         # Message handlers
│   │       │
│   │       ├── config/                 # Configuration
│   │       │   ├── mod.rs
│   │       │   ├── loader.rs           # Load config files
│   │       │   └── defaults.rs         # Default values
│   │       │
│   │       └── models/                 # Data structures
│   │           ├── mod.rs
│   │           ├── note.rs
│   │           ├── session.rs
│   │           ├── config.rs
│   │           └── workspace.rs
│   │
│   └── static/                         # Static assets
│       └── fonts/
│
├── mcp-server/                         # MCP server (Bun)
│   ├── package.json
│   ├── tsconfig.json
│   ├── bun.lockb
│   │
│   └── src/
│       ├── index.ts                    # Entry point, server setup
│       │
│       ├── resources/                  # MCP resources
│       │   ├── index.ts                # Resource registration
│       │   ├── current.ts              # note://current
│       │   ├── file.ts                 # note://file/{path}
│       │   ├── today.ts                # note://today
│       │   ├── recent.ts               # note://recent
│       │   └── config.ts               # note://config
│       │
│       ├── tools/                      # MCP tools
│       │   ├── index.ts                # Tool registration
│       │   ├── process.ts              # process_meeting
│       │   ├── list.ts                 # list_notes
│       │   ├── actions.ts              # get_actions
│       │   └── write.ts                # write_processed
│       │
│       ├── prompts/                    # MCP prompts
│       │   ├── index.ts                # Prompt registration
│       │   ├── standard.ts             # process-standard
│       │   ├── oneonone.ts             # process-focused
│       │   └── structured.ts                # process-structured
│       │
│       ├── processing/                 # AI processing logic
│       │   ├── index.ts
│       │   ├── parser.ts               # Marker parsing
│       │   ├── prompt-builder.ts       # Build Claude prompts
│       │   ├── response-parser.ts      # Parse Claude responses
│       │   └── writer.ts               # Write processed output
│       │
│       ├── websocket/                  # Chronicle app communication
│       │   ├── client.ts               # WebSocket client
│       │   └── messages.ts             # Message types
│       │
│       ├── storage/                    # File system access
│       │   ├── workspace.ts            # Workspace operations
│       │   ├── files.ts                # File read/write
│       │   └── meta.ts                 # Metadata JSON
│       │
│       └── types/                      # TypeScript types
│           ├── note.ts
│           ├── mcp.ts
│           └── config.ts
│
├── shared/                             # Shared code (if needed)
│   └── types/                          # Types shared between app and MCP
│       ├── note.ts
│       └── config.ts
│
├── scripts/                            # Development scripts
│   ├── dev.sh                          # Start all in dev mode
│   ├── build.sh                        # Production build
│   └── setup.sh                        # Initial setup
│
└── .github/                            # GitHub config
    └── workflows/
        ├── ci.yml                      # CI pipeline
        └── release.yml                 # Release builds
```

## Key File Descriptions

### App Entry Points

| File | Purpose |
|------|---------|
| `app/src/main.ts` | Svelte app initialization |
| `app/src/App.svelte` | Root component, four-pane layout |
| `app/src-tauri/src/main.rs` | Tauri app entry, window creation |
| `mcp-server/src/index.ts` | MCP server initialization |

### Core Logic Files

| File | Purpose |
|------|---------|
| `app/src/lib/editor/Editor.svelte` | Main editing experience |
| `app/src/stores/note.ts` | Central note state |
| `app/src-tauri/src/storage/autosave.rs` | Auto-save debouncing |
| `app/src-tauri/src/session/tracker.rs` | Session state machine |
| `mcp-server/src/tools/process.ts` | Core processing tool |
| `mcp-server/src/processing/parser.ts` | Marker parsing logic |

### Configuration Files

| File | Purpose |
|------|---------|
| `app/src-tauri/tauri.conf.json` | Tauri build config, window settings |
| `app/vite.config.ts` | Frontend build config |
| `app/src-tauri/Cargo.toml` | Rust dependencies |
| `mcp-server/package.json` | MCP server dependencies |

## Module Responsibilities

### Frontend Stores

```
workspace.ts
├── currentWorkspace: string | null
├── files: FileNode[]
├── recentWorkspaces: Workspace[]
├── openWorkspace(path)
├── refreshFiles()
└── closeWorkspace()

note.ts
├── currentNote: Note | null
├── isDirty: boolean
├── openNote(path)
├── updateContent(content)
├── saveNote()
└── closeNote()

session.ts
├── session: NoteSession | null
├── isActive: boolean
├── startSession()
├── recordEdit()
├── endSession()
└── addAnnotation()

aiOutput.ts
├── result: AIOutput | null
├── isProcessing: boolean
├── error: string | null
├── setResult(result)
├── setProcessing(bool)
└── clear()

config.ts
├── config: AppConfig
├── loadConfig()
├── updateConfig(partial)
└── resetConfig()

ui.ts
├── paneWidths: { explorer, aiOutput }
├── paneHeights: { terminal }
├── collapsedPanes: Set<string>
├── setPaneWidth(pane, width)
├── toggleCollapse(pane)
└── persistState()
```

### Backend Commands (Tauri IPC)

```rust
// File operations
#[tauri::command]
fn read_file(path: &str) -> Result<String, String>

#[tauri::command]
fn write_file(path: &str, content: &str) -> Result<(), String>

#[tauri::command]
fn list_files(workspace: &str) -> Result<Vec<FileNode>, String>

// Workspace
#[tauri::command]
fn open_workspace(path: &str) -> Result<WorkspaceInfo, String>

#[tauri::command]
fn get_recent_workspaces() -> Result<Vec<Workspace>, String>

// Session
#[tauri::command]
fn get_session(file_path: &str) -> Result<Option<Session>, String>

#[tauri::command]
fn start_session(file_path: &str) -> Result<Session, String>

#[tauri::command]
fn end_session(file_path: &str) -> Result<Session, String>

// Config
#[tauri::command]
fn get_config() -> Result<AppConfig, String>

#[tauri::command]
fn update_config(config: AppConfig) -> Result<(), String>

// Processing
#[tauri::command]
fn trigger_processing(file_path: &str, style: &str) -> Result<(), String>

// PTY
#[tauri::command]
fn spawn_pty(workspace: &str) -> Result<PtyHandle, String>

#[tauri::command]
fn write_pty(handle: PtyHandle, data: &str) -> Result<(), String>

#[tauri::command]
fn resize_pty(handle: PtyHandle, cols: u16, rows: u16) -> Result<(), String>
```

### MCP Server Tools

```typescript
// tools/process.ts
export async function processNote(
  path: string,
  style: ProcessingStyle,
  focus?: string
): Promise<ProcessingResult>

// tools/list.ts
export async function listNotes(
  dateFrom?: string,
  dateTo?: string,
  search?: string,
  processedOnly?: boolean,
  limit?: number
): Promise<NoteListResult>

// tools/actions.ts
export async function getActions(
  owner?: string,
  dateFrom?: string,
  includeDone?: boolean
): Promise<ActionsResult>
```

## Build Outputs

### Development

```
app/
├── src-tauri/target/debug/chronicle     # Debug binary
└── dist/                                 # Vite dev output

mcp-server/
└── (runs directly with bun)
```

### Production

```
dist/
├── chronicle-macos-arm64.dmg
├── chronicle-macos-x64.dmg
├── chronicle-windows-x64.msi
├── chronicle-linux-x64.AppImage
└── chronicle-mcp-server.tar.gz          # MCP server bundle
```

## Development Workflow

```bash
# Terminal 1: Tauri app (auto-reloads)
cd app
npm run tauri dev

# Terminal 2: MCP server (for testing)
cd mcp-server
bun run dev

# Terminal 3: Run Chronicle MCP through Claude Code
# (register MCP server, then use normally)
```

---

*Document version: 1.0*
*Last updated: 2024-12-10*