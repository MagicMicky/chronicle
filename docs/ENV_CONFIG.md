# Chronicle — Environment & Configuration

## Development Environment Setup

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20+ | Frontend tooling |
| Rust | 1.75+ | Tauri backend |
| Bun | 1.0+ | MCP server runtime |
| Tauri CLI | 2.0+ | Build tooling |

### Installation (macOS)

```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Node.js (via nvm recommended)
nvm install 20
nvm use 20

# Bun
curl -fsSL https://bun.sh/install | bash

# Tauri CLI
cargo install tauri-cli

# Verify
rustc --version    # rustc 1.75.0+
node --version     # v20.x.x
bun --version      # 1.x.x
cargo tauri --version  # tauri-cli 2.x.x
```

### Installation (Linux)

```bash
# System dependencies (Debian/Ubuntu)
sudo apt update
sudo apt install -y \
  build-essential \
  curl \
  wget \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  libwebkit2gtk-4.1-dev

# Then same as macOS for Rust, Node, Bun, Tauri
```

### Installation (Windows)

```powershell
# Install Visual Studio Build Tools
# Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/
# Select "Desktop development with C++"

# Rust
winget install Rustlang.Rustup

# Node.js
winget install OpenJS.NodeJS.LTS

# Bun
powershell -c "irm bun.sh/install.ps1 | iex"

# Tauri CLI
cargo install tauri-cli
```

## Environment Variables

### Development

Create `.env` in project root:

```bash
# Required: Claude API key for processing
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Optional: Override default workspace (for testing)
CHRONICLE_WORKSPACE=/path/to/test/workspace

# Optional: WebSocket port for MCP ↔ App communication
CHRONICLE_WS_PORT=9847

# Optional: Enable debug logging
CHRONICLE_DEBUG=true

# Optional: Log level (error, warn, info, debug, trace)
RUST_LOG=chronicle=debug
```

### Production

Environment variables for production builds:

```bash
# Only required at runtime for AI features
ANTHROPIC_API_KEY=sk-ant-xxxxx

# All other config from ~/.chronicle/ or workspace/.chronicle/
```

## Configuration Files

### Application Config

**Location:** `~/.chronicle/app.yaml` (global) or `{workspace}/.chronicle/config.yaml` (per-workspace)

Workspace config overrides global config.

```yaml
# Chronicle Application Configuration
version: 1

# Semantic markers for note categorization
markers:
  thought: ">"           # My thoughts / things to say
  important: "!"         # Important points from others
  question: "?"          # Questions / unclear items
  action: "[]"           # Action items
  attribution: "@"       # @name: attribution
  # Add custom markers:
  # decision: "=="
  # risk: "⚠"

# Marker colors (hex or named)
marker_colors:
  thought: "#7c3aed"     # purple
  important: "#dc2626"   # red
  question: "#f59e0b"    # amber
  action: "#10b981"      # emerald
  attribution: "#6b7280" # gray

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
  font_family: "JetBrains Mono, Fira Code, monospace"
  font_size: 14
  line_height: 1.6
  tab_size: 2
  theme: "dark"          # dark | light
  vim_mode: false
  show_line_numbers: false
  word_wrap: true

# AI processing defaults
processing:
  default_style: "standard"  # standard | brief | detailed | focused | structured
  auto_process: false        # Auto-process when session ends
  model: "claude-sonnet-4-20250514"    # Claude model to use

# Terminal preferences
terminal:
  shell: null                # null = system default, or explicit path
  font_family: "JetBrains Mono, monospace"
  font_size: 13
  scrollback: 10000

# Window state (managed automatically)
window:
  remember_size: true
  remember_position: true
```

### MCP Server Config

**Location:** `~/.config/claude/claude_desktop_config.json` (for Claude Desktop) or similar for Claude Code

```json
{
  "mcpServers": {
    "chronicle": {
      "command": "bun",
      "args": ["run", "/path/to/chronicle/mcp-server/src/index.ts"],
      "env": {
        "CHRONICLE_WS_PORT": "9847"
      }
    }
  }
}
```

## File Locations by Platform

### macOS

| Data | Location |
|------|----------|
| Application | `/Applications/Chronicle.app` |
| Global config | `~/Library/Application Support/chronicle/` |
| Logs | `~/Library/Logs/chronicle/` |
| Cache | `~/Library/Caches/chronicle/` |
| Recent workspaces | `~/Library/Application Support/chronicle/recent-workspaces.json` |

### Windows

| Data | Location |
|------|----------|
| Application | `C:\Program Files\Chronicle\` |
| Global config | `%APPDATA%\chronicle\` |
| Logs | `%APPDATA%\chronicle\logs\` |
| Cache | `%LOCALAPPDATA%\chronicle\cache\` |
| Recent workspaces | `%APPDATA%\chronicle\recent-workspaces.json` |

### Linux

| Data | Location |
|------|----------|
| Application | `/usr/bin/chronicle` or AppImage |
| Global config | `~/.config/chronicle/` |
| Logs | `~/.local/share/chronicle/logs/` |
| Cache | `~/.cache/chronicle/` |
| Recent workspaces | `~/.config/chronicle/recent-workspaces.json` |

## Workspace Structure

When user opens/creates a workspace:

```
{workspace}/
├── [note files].md           # User's notes
├── .raw/                        # Original captures (auto-created)
├── .meta/                       # Metadata JSON (auto-created)
└── .chronicle/                  # Workspace config (auto-created)
    ├── config.yaml              # Workspace-specific settings
    └── state.json               # UI state (pane sizes, etc.)
```

## Build Configuration

### Tauri Config (`app/src-tauri/tauri.conf.json`)

```json
{
  "productName": "Chronicle",
  "version": "0.1.0",
  "identifier": "com.chronicle.app",
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devUrl": "http://localhost:5173",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "Chronicle",
        "width": 1400,
        "height": 900,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false,
        "decorations": true
      }
    ],
    "security": {
      "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
    }
  },
  "bundle": {
    "active": true,
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "targets": ["dmg", "msi", "appimage"],
    "macOS": {
      "minimumSystemVersion": "10.15"
    }
  },
  "plugins": {
    "shell": {
      "open": true
    }
  }
}
```

### Vite Config (`app/vite.config.ts`)

```typescript
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: ['es2021', 'chrome100', 'safari14'],
    minify: !process.env.TAURI_DEBUG,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
```

## Security Considerations

### API Key Storage

- **Development:** `.env` file (git-ignored)
- **Production:** System keychain or environment variable
- **Never:** Stored in app config files

### Network Access

- MCP server binds to `127.0.0.1` only
- WebSocket server binds to `127.0.0.1` only
- Only outbound connection: Claude API (`api.anthropic.com`)

### File Access

- App only accesses user-selected workspace folder
- No access to files outside workspace without explicit user action
- Raw files preserved (immutable after session end)

### Tauri Permissions

```json
{
  "permissions": [
    "core:default",
    "shell:allow-open",
    "dialog:allow-open",
    "dialog:allow-save",
    "fs:allow-read",
    "fs:allow-write",
    "process:allow-exit"
  ]
}
```

## CI/CD Configuration

### GitHub Actions (`.github/workflows/ci.yml`)

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: cd app && npm ci
      - run: cd app && npm run check
      - run: cd app && npm run lint

  test-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: cd app/src-tauri && cargo test
      - run: cd app/src-tauri && cargo clippy -- -D warnings

  test-mcp:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: cd mcp-server && bun install
      - run: cd mcp-server && bun test
      - run: cd mcp-server && bun run typecheck

  build:
    needs: [test-frontend, test-backend, test-mcp]
    strategy:
      matrix:
        os: [macos-latest, ubuntu-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - uses: dtolnay/rust-toolchain@stable
      - uses: oven-sh/setup-bun@v1
      - run: cd app && npm ci
      - run: cd app && npm run tauri build
      - uses: actions/upload-artifact@v4
        with:
          name: chronicle-${{ matrix.os }}
          path: app/src-tauri/target/release/bundle/
```

---

*Document version: 1.0*
*Last updated: 2024-12-10*