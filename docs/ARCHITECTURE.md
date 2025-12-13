# Chronicle — Technical Architecture

## Overview

Chronicle is a desktop application built with Tauri 2.0, combining a Rust backend with a Svelte frontend. It integrates with Claude Code via an MCP (Model Context Protocol) server for AI-powered note processing.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Chronicle App                                   │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         Svelte Frontend                                 │ │
│  │  ┌──────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐  │ │
│  │  │ Explorer │ │    Editor    │ │  AI Output   │ │     Terminal     │  │ │
│  │  │  (Tree)  │ │ (CodeMirror) │ │  (Rendered)  │ │    (xterm.js)    │  │ │
│  │  └────┬─────┘ └──────┬───────┘ └──────┬───────┘ └────────┬─────────┘  │ │
│  │       │              │                │                   │            │ │
│  │       └──────────────┴────────────────┴───────────────────┘            │ │
│  │                              │                                          │ │
│  │                      Tauri IPC Bridge                                   │ │
│  └──────────────────────────────┼──────────────────────────────────────────┘ │
│                                 │                                            │
│  ┌──────────────────────────────┴──────────────────────────────────────────┐ │
│  │                          Rust Backend                                    │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐   │ │
│  │  │   Storage   │ │   Session   │ │     PTY     │ │    WebSocket    │   │ │
│  │  │   Manager   │ │   Tracker   │ │   Manager   │ │     Server      │   │ │
│  │  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └────────┬────────┘   │ │
│  │         │               │               │                  │            │ │
│  └─────────┼───────────────┼───────────────┼──────────────────┼────────────┘ │
└────────────┼───────────────┼───────────────┼──────────────────┼──────────────┘
             │               │               │                  │
             ▼               │               ▼                  │
    ┌────────────────┐       │      ┌────────────────┐          │
    │   File System  │       │      │  Claude Code   │          │
    │                │       │      │   (Terminal)   │          │
    │  ~/workspace/  │       │      └───────┬────────┘          │
    │   ├── notes    │       │              │                   │
    │   ├── .raw/    │       │              │                   │
    │   ├── .meta/   │       │              ▼                   │
    │   └── .config/ │       │      ┌────────────────┐          │
    └────────────────┘       │      │   MCP Server   │◄─────────┘
                             │      │   (Bun/TS)     │
                             │      └───────┬────────┘
                             │              │
                             │              ▼
                             │      ┌────────────────┐
                             └─────►│  Claude API    │
                                    │  (Anthropic)   │
                                    └────────────────┘
```

## Component Details

### 1. Tauri Application (Rust + Svelte)

**Framework:** Tauri 2.0
**Why Tauri:**
- Small binary size (~10MB vs Electron's ~150MB)
- Native performance
- Rust backend for file operations and security
- Cross-platform (macOS, Windows, Linux)
- Built-in IPC between frontend and backend

#### Rust Backend Modules

| Module | Responsibility |
|--------|----------------|
| `storage` | File read/write, workspace management, auto-save |
| `session` | Session tracking, duration inference, annotation detection |
| `git` | Repository initialization, auto-commits, history queries |
| `pty` | Terminal process management (PTY spawning, I/O streaming) |
| `websocket` | Local WebSocket server for MCP communication |
| `commands` | Tauri command handlers (IPC endpoints) |
| `config` | User preferences, marker definitions, workspace settings |

#### Svelte Frontend Components

| Component | Responsibility |
|-----------|----------------|
| `Explorer.svelte` | File tree navigation, workspace display |
| `Editor.svelte` | CodeMirror integration, markdown editing |
| `AIOutput.svelte` | Structured display of processing results |
| `Terminal.svelte` | xterm.js integration, PTY communication |
| `StatusBar.svelte` | Session info, save status, notifications |
| `App.svelte` | Layout orchestration, pane management |

### 2. MCP Server (Bun + TypeScript)

**Runtime:** Bun 1.0+
**Protocol:** Model Context Protocol (stdio transport)
**Purpose:** Bridge between Claude Code and Chronicle

The MCP server runs as a separate process, registered with Claude Code. It communicates with the Chronicle app via local WebSocket for real-time updates.

#### MCP Components

| Component | Purpose |
|-----------|---------|
| Resources | Expose notes as queryable URIs |
| Tools | Provide processing actions Claude can invoke |
| Prompts | Reusable prompt templates for different note types |

### 3. Data Flow

#### Note Capture Flow

```
User types → CodeMirror → Svelte state → Tauri IPC → Rust storage
                                                          │
                                                          ▼
                                                    File system
                                                    (debounced 2s)
```

#### AI Processing Flow

```
User: "process current note"
         │
         ▼
    Claude Code
         │
         ▼
    MCP Server
         │
    ┌────┴────┐
    │ Read    │◄─── WebSocket ◄─── Chronicle App (current file path)
    │ notes   │
    └────┬────┘
         │
         ▼
    ┌─────────┐
    │ Claude  │
    │   API   │
    └────┬────┘
         │
         ▼
    ┌─────────┐
    │ Parse   │
    │ response│
    └────┬────┘
         │
    ┌────┴────┐
    │ Write   │───► .meta/note.json
    │ outputs │───► WebSocket ───► Chronicle App ───► AI Output pane
    └─────────┘
```

#### Session Tracking Flow

```
First edit ──► Start session timer
                    │
         ┌──────────┴──────────┐
         │                     │
    Edit within 15min     No edit for 15min
         │                     │
         ▼                     ▼
    Reset inactivity      End session
       timer                   │
         │                     ▼
         │              Mark subsequent edits
         │              as "annotations"
         │                     │
         └─────────────────────┘
                    │
              2 hour max ──► Force end session
```

#### Git Commit Flow

```
Semantic Event ──► Stage Changes ──► Create Commit
       │                                   │
       │                                   ▼
       │                          Commit Message Format:
       │                          {type}: {title} ({detail})
       │
       ├── Session End ────────► "session: Project Kickoff (32m)"
       │
       ├── Processing ─────────► "process: Project Kickoff (structured)"
       │
       ├── Annotations ────────► "annotate: Project Kickoff (+3)"
       │
       └── Manual (Cmd+Shift+S) ► "snapshot: Project Kickoff"

Files staged per event:
├── Session End: *.md, .meta/*.json
├── Processing:  *.md, .raw/*.md, .meta/*.json
└── Annotations: *.md, .meta/*.json
```

## Tech Stack

### Core Dependencies

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| App Framework | Tauri | 2.0 | Desktop app shell |
| Backend | Rust | 1.75+ | File I/O, PTY, WebSocket |
| Frontend | Svelte | 4.0 | UI components |
| Bundler | Vite | 5.0 | Frontend build |
| Editor | CodeMirror | 6.0 | Markdown editing |
| Terminal | xterm.js | 5.0 | Terminal emulation |
| MCP Runtime | Bun | 1.0 | MCP server execution |
| MCP SDK | @modelcontextprotocol/sdk | latest | MCP implementation |

### Rust Crates

```toml
[dependencies]
tauri = { version = "2.0", features = ["shell-open"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1.0", features = ["full"] }
tokio-tungstenite = "0.21"        # WebSocket
portable-pty = "0.8"              # PTY management
git2 = "0.18"                     # Git operations
notify = "6.0"                    # File watching
chrono = "0.4"                    # Timestamps
uuid = { version = "1.0", features = ["v4"] }
directories = "5.0"               # Platform paths
```

### Frontend Packages

```json
{
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "svelte": "^4.0.0",
    "@codemirror/view": "^6.0.0",
    "@codemirror/state": "^6.0.0",
    "@codemirror/lang-markdown": "^6.0.0",
    "@codemirror/theme-one-dark": "^6.0.0",
    "xterm": "^5.0.0",
    "xterm-addon-fit": "^0.8.0",
    "xterm-addon-web-links": "^0.9.0"
  }
}
```

### MCP Server Packages

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "@anthropic-ai/sdk": "^0.25.0"
  }
}
```

## External Services

| Service | Purpose | Auth Method | Fallback |
|---------|---------|-------------|----------|
| Claude API | Note processing | API key in env | Error message, retry later |

No other external services required. Entirely local-first.

## Security Considerations

### Data at Rest

- All notes stored as plain markdown files
- No encryption by default (user's filesystem security)
- Sensitive files can be excluded via `.chronicleignore`

### Network

- MCP server binds to localhost only (127.0.0.1)
- No external network requests except Claude API
- API key stored in environment variable, never in files

### Process Isolation

- MCP server runs as separate process
- Terminal PTY isolated from main app
- WebSocket communication on random available port

## Platform-Specific Notes

### macOS

- App bundle in `/Applications/Chronicle.app`
- Config in `~/Library/Application Support/chronicle/`
- Notarization required for distribution

### Windows

- Installer via WiX or NSIS
- Config in `%APPDATA%\chronicle\`
- May need Windows Defender exclusion for PTY

### Linux

- AppImage for distribution
- Config in `~/.config/chronicle/`
- May need additional packages for PTY (varies by distro)

## Performance Targets

| Operation | Target | Measurement |
|-----------|--------|-------------|
| App startup | <2s | Time to interactive |
| Keystroke latency | <16ms | Input to render |
| Auto-save | <100ms | Write completion |
| File tree render | <200ms | 1000 files |
| AI processing | <10s | Typical notes |

## Error Handling Strategy

| Error Type | Handling |
|------------|----------|
| File I/O failure | Retry 3x, then surface error to user with recovery options |
| WebSocket disconnect | Auto-reconnect with exponential backoff |
| Claude API error | Display error, allow retry, suggest offline mode |
| PTY failure | Restart PTY, preserve command history |
| Crash | Auto-save on crash signal, crash report on restart |

---

*Document version: 1.0*
*Last updated: 2024-12-10*