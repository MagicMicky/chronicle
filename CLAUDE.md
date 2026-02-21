# Chronicle — Claude Code Guidelines

## Current Status

- **Completed**: M0 Foundation (v0.1.0), M1 Editor (v0.2.2), M2 Storage (v0.3.0), M3 Session (v0.4.2), M4 Terminal (v0.5.1), M5 MCP Server (v0.6.0), M6 AI Output (v0.7.0)
- **Next**: M7 Integration & Polish (keyboard shortcuts, processing button, edge case handling)
- **CI**: GitHub Actions builds on tag push (Windows, macOS, Linux)
- **Latest tag**: v0.6.0

### M6 AI Output - What Was Built

**Approach**: Tauri events for real-time push notifications + file parsing for structured sections.

**Rust Backend** (`app/src-tauri/src/`):
- `websocket/handlers.rs` - Emit Tauri events (`ai:processing-complete`, `ai:processing-error`) on WebSocket push
- `websocket/server.rs` - Added `app_handle` to `AppState` for event emission
- `commands/file.rs` - Added `read_processed_file` command to parse markdown sections
- `lib.rs` - Setup hook to store `AppHandle` in shared state

**Frontend** (`app/src/lib/`):
- `stores/aiOutput.ts` - Enhanced with `ParsedSections`, `ActionItem` types, event listeners, `loadSections` method
- `ai-output/AIOutput.svelte` - Full rewrite with state handling (ready, processing, error, result)
- `ai-output/Summary.svelte` - TL;DR section component
- `ai-output/KeyPoints.svelte` - Key points bullet list component
- `ai-output/ActionList.svelte` - Action items checklist component
- `ai-output/Questions.svelte` - Open questions list component
- `routes/+layout.svelte` - Initialize AI event listeners on mount

**Key behaviors**:
- Tauri events emitted when MCP server pushes processing results
- Frontend listens to events and updates store immediately
- Sections parsed from processed markdown file via Tauri command
- UI shows structured sections: TL;DR, Key Points, Action Items, Questions
- States: Ready to process, Processing (spinner), Error (with dismiss), Result
- "View Raw" toggle to show original notes
- Auto-clear when switching files
- Metadata footer shows processed time, style, token counts

### M5 MCP Server - What Was Built

**Approach**: Node/TypeScript MCP server with stdio transport + WebSocket communication to Tauri app.

**MCP Server** (`mcp-server/`):
- `src/index.ts` - MCP server entry point, registers resources and tools
- `src/websocket/client.ts` - WebSocket client connecting to Chronicle app
- `src/websocket/messages.ts` - WebSocket message type definitions
- `src/resources/current.ts` - `note://current` resource (fetches current file via WS)
- `src/resources/config.ts` - `note://config` resource (marker configuration)
- `src/tools/process.ts` - `process_meeting` tool (calls Claude API, writes output)
- `src/tools/history.ts` - `get_history`, `get_version`, `compare_versions` tools
- `src/processing/parser.ts` - Marker parsing (`>`, `!`, `?`, `[]`, `@`)
- `src/processing/prompt-builder.ts` - Claude API prompt construction

**Rust WebSocket Server** (`app/src-tauri/src/websocket/`):
- `server.rs` - WebSocket server on port 9847, handles MCP connections
- `handlers.rs` - Message handlers for `getCurrentFile`, `getWorkspacePath`, push events
- `mod.rs` - Module exports

**Rust Commands** (`app/src-tauri/src/commands/`):
- `appstate.rs` - `update_app_state`, `get_ws_port`, `get_processing_result` commands

**Frontend** (`app/src/lib/stores/`):
- `aiOutput.ts` - Store for AI processing results
- `appState.ts` - Utility to sync file/workspace state to backend
- Updated `workspace.ts` and `note.ts` to sync state on changes

**Dependencies added**:
- Rust: `tokio-tungstenite = "0.24"`, `futures-util = "0.3"`
- npm (mcp-server): `@modelcontextprotocol/sdk`, `@anthropic-ai/sdk`, `ws`, `zod`, `tsx`

**Key behaviors**:
- MCP server connects to Chronicle app via WebSocket on port 9847
- `process_meeting` tool parses markers, calls Claude API, writes processed output
- Original notes backed up to `.raw/` before processing
- Processing metadata stored in `.meta/` JSON files
- Git history tools query commit history for notes
- Frontend syncs current file/workspace to backend for MCP queries
- Processing results stored in app state (UI display in M6)

**MCP Tools available**:
- `process_meeting` - Process raw notes into structured summary
- `get_history` - Get git history for a note
- `get_version` - Get note content at specific commit
- `compare_versions` - Show diff between two versions
- `chronicle_status` - Check connection status

**MCP Registration** (add to `~/.claude.json`):
```json
{
  "mcpServers": {
    "chronicle": {
      "command": "npx",
      "args": ["tsx", "/path/to/chronicle/mcp-server/src/index.ts"],
      "env": {
        "ANTHROPIC_API_KEY": "${ANTHROPIC_API_KEY}"
      }
    }
  }
}
```

### Notes for M6 AI Output

M6 requires:
- Create AI Output pane UI components (Summary, KeyPoints, ActionList, Questions)
- Display processing results from aiOutput store
- Show processing state indicators (ready, processing, complete, error)
- Connect to processingComplete push events via Tauri events
- See `docs/MILESTONES.md` for acceptance criteria

## Project Overview

Chronicle is a local-first, AI-powered note-taking application. Users capture thoughts in markdown with semantic markers, then Claude processes them into structured summaries with action items and insights.

**Tech Stack:**
- **App**: Tauri 2.0 (Rust backend, Svelte frontend)
- **MCP Server**: Bun + TypeScript
- **Editor**: CodeMirror 6
- **Terminal**: xterm.js with PTY
- **Storage**: Local files + git version control

**Key Concepts:**
- **Session**: A note-taking period (auto-tracked duration)
- **Markers**: Quick prefixes (`>`, `!`, `?`, `[]`, `@`) for categorization
- **Processing**: AI transforms raw → structured notes via MCP
- **Workspace**: User's folder (auto-versioned with git)

## Documentation Structure

```
docs/
├── README.md              # Start here - navigation guide
├── QUICK_START.md         # User-facing reference
├── PRD.md                 # Product requirements (the "why")
├── ARCHITECTURE.md        # Technical design (the "how")
├── DATA_MODELS.md         # Data structures and schemas
├── MCP_API.md            # MCP server API contracts
├── PROJECT_STRUCTURE.md   # File organization (the "where")
├── USER_STORIES.md        # Features as user stories
├── ENV_CONFIG.md          # Setup and configuration
└── MILESTONES.md          # Build order (the "when")
```

**Before starting any work:**
1. Read `MILESTONES.md` to understand current phase
2. Read `PROJECT_STRUCTURE.md` to know where files go
3. Read relevant technical docs (`ARCHITECTURE.md`, `DATA_MODELS.md`, etc.)

## File Structure

```
chronicle/
├── app/                    # Tauri application
│   ├── src/               # Svelte frontend
│   └── src-tauri/         # Rust backend
├── mcp-server/            # MCP server (Bun)
├── docs/                  # Documentation
└── scripts/               # Dev scripts
```

**Golden Rule:** Follow `PROJECT_STRUCTURE.md` exactly. Don't create files in unexpected locations.

## Development Workflow

### Starting Work

```bash
# Read current milestone
cat docs/MILESTONES.md

# Check what's being built
git log --oneline -10

# Start dev environment
./scripts/dev.sh  # (or run app and MCP server separately)
```

### Completing Tasks

1. **Implement the feature** following acceptance criteria
2. **Test manually** (run the app, verify behavior)
3. **Commit with semantic message** (see Git Conventions below)
4. **Update milestone checklist** if completing acceptance criteria
5. **Push to remote**: `git push origin main`

### Releasing (Milestones & Features)

When completing a **milestone** or significant **feature**:

1. **Commit** with appropriate message (`milestone:` or `feat:`)
2. **Push to remote**: `git push origin main`
3. **Tag for release** (triggers CI builds for all platforms):
   ```bash
   git tag v0.X.0
   git push origin v0.X.0
   ```

**Version numbering:**
- `v0.1.0` — M0 Foundation
- `v0.2.0` — M1 Editor
- `v0.3.0` — M2 Storage
- etc.

GitHub Actions will automatically build Windows, macOS, and Linux installers when a tag is pushed.

### When to Commit

**Always commit:**
- ✅ After completing a user story or acceptance criterion
- ✅ After implementing a complete module/component
- ✅ Before switching to a different milestone or feature
- ✅ After fixing a bug that affected functionality
- ✅ At the end of a work session (even if incomplete, with WIP message)

**Never commit:**
- ❌ Code that doesn't compile/run
- ❌ Broken functionality (unless explicitly WIP)
- ❌ Without testing basic functionality first

**Commit messages should be semantic:**

```bash
# Feature completion
git commit -m "feat(editor): add semantic marker highlighting"
git commit -m "feat(session): implement auto-end after 15min inactivity"

# Bug fixes
git commit -m "fix(autosave): debounce not triggering on rapid edits"

# Work in progress (if needed)
git commit -m "wip(terminal): partial PTY integration"

# Milestone completion
git commit -m "milestone: M1 Editor complete - all acceptance criteria met"
```

## Git Conventions

Chronicle uses git version control throughout. User workspaces have git repos with semantic commits.

**App development commits** (your commits):
```
feat(scope): description
fix(scope): description
docs(scope): description
test(scope): description
refactor(scope): description
wip(scope): description
milestone: description
```

**User workspace commits** (auto-generated by app):
```
session: Note Title (32m)    # on file close
process: Note Title (standard)  # on AI processing (M5+)
snapshot: Note Title           # manual snapshot
```

**Scopes:** `editor`, `session`, `storage`, `git`, `mcp`, `terminal`, `ui`, `config`

## Coding Standards

### Rust (Tauri Backend)

```rust
// Use explicit error types, not unwrap()
fn read_file(path: &Path) -> Result<String, StorageError> {
    fs::read_to_string(path)
        .map_err(|e| StorageError::ReadFailed(path.to_path_buf(), e))
}

// Prefer async/await for I/O
#[tauri::command]
async fn save_file(path: String, content: String) -> Result<(), String> {
    tokio::fs::write(&path, content).await
        .map_err(|e| format!("Failed to save: {}", e))
}

// Use structured logging
use tracing::{info, warn, error};
info!("Session ended: duration={}m", duration);
```

**Patterns to follow:**
- Commands return `Result<T, String>` (Tauri serializes errors)
- Use `tracing` for logging, not `println!`
- Keep commands thin, logic in modules
- Use `serde` for serialization

### TypeScript/Svelte (Frontend)

```typescript
// Use explicit types, no 'any'
interface Session {
  startedAt: Date;
  durationMinutes: number;
  isActive: boolean;
}

// Svelte stores for state
import { writable } from 'svelte/store';
export const currentSession = writable<Session | null>(null);

// Error handling
try {
  await invoke('save_file', { path, content });
} catch (error) {
  console.error('Save failed:', error);
  // Show user-facing error
}
```

**Patterns to follow:**
- Svelte stores for shared state
- TypeScript strict mode enabled
- No `console.log` in production (use proper logging)
- Components < 300 lines (split if larger)

### Bun/TypeScript (MCP Server)

```typescript
// Use MCP SDK types
import { McpServer, Resource, Tool } from '@modelcontextprotocol/sdk';

// Structured tool definitions
const processMeetingTool: Tool = {
  name: 'process_meeting',
  description: 'Process raw notes into structured summary',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string' },
      style: { type: 'string', enum: ['standard', 'brief', 'detailed', 'focused', 'structured'] }
    },
    required: ['path']
  }
};

// Always handle errors gracefully
try {
  const result = await processNotes(path, style);
  return { content: [{ type: 'text', text: result }] };
} catch (error) {
  return { 
    content: [{ type: 'text', text: `Error: ${error.message}` }],
    isError: true 
  };
}
```

**Patterns to follow:**
- Use MCP SDK types (don't reinvent)
- WebSocket reconnection logic with exponential backoff
- Validate all inputs from Claude
- Never expose file system outside workspace

## Common Commands

### Development

```bash
# Run app in dev mode
cd app && npm run tauri dev

# Run MCP server
cd mcp-server && bun run dev

# Type checking
cd app && npm run check
cd mcp-server && bun run typecheck

# Linting
cd app && npm run lint
cd app/src-tauri && cargo clippy
```

### Building

```bash
# Build app for current platform
cd app && npm run tauri build

# Build MCP server bundle
cd mcp-server && bun build src/index.ts --outdir dist
```

### Testing

```bash
# Rust tests
cd app/src-tauri && cargo test

# Frontend type checking
cd app && npm run check

# MCP server tests
cd mcp-server && bun test
```

## Key Reminders

### For Milestone-Based Work

1. **Always read the milestone first**: `docs/MILESTONES.md`
2. **Check dependencies**: Don't start M5 if M2-M4 aren't done
3. **Follow acceptance criteria**: They define "done"
4. **Update milestone checklist**: Mark items complete as you go

### For Code Quality

1. **No magic numbers**: Use constants with clear names
2. **No TODO comments**: Create issues or fix immediately
3. **No dead code**: Delete unused functions/imports
4. **Error messages for users**: Not debug output

### For Git Hygiene

1. **Commit atomically**: One logical change per commit
2. **Write clear messages**: Future you will thank you
3. **Don't commit secrets**: API keys, passwords, etc.
4. **Test before committing**: Even simple changes

## MCP Server Development

When working on the MCP server, remember:

- **Resources** are read-only data (meeting://current, etc.)
- **Tools** are actions Claude can take (process_meeting, etc.)
- **Prompts** are reusable templates

Always test MCP changes by:
1. Registering server with Claude Code
2. Actually using it in terminal: `claude "test command"`
3. Checking WebSocket communication with Chronicle app

## Common Pitfalls

| Pitfall | Solution |
|---------|----------|
| Forgetting to update milestone checklist | Check after each commit |
| Not reading docs before coding | ALWAYS read relevant docs first |
| Using wrong file paths | Follow PROJECT_STRUCTURE.md exactly |
| Committing broken code | Test manually before commit |
| Not handling errors | Every operation can fail, handle it |
| Hardcoding workspace paths | Always use relative paths |
| Forgetting cross-platform | Test on macOS/Windows/Linux |

## Working with Claude Code

When I (Claude) am helping you build Chronicle:

1. **I start by reading docs**: Especially MILESTONES.md and PROJECT_STRUCTURE.md
2. **I commit when appropriate**: After completing features, before context switches
3. **I follow the structure**: No improvising file locations
4. **I test before committing**: Run the code, verify it works
5. **I write clear commit messages**: Semantic, descriptive
6. **I update docs**: If implementation differs from spec

If you ask me to implement a feature:
- I'll identify which milestone it belongs to
- I'll check dependencies are complete
- I'll implement according to acceptance criteria
- I'll commit with a clear message
- I'll push to remote (`git push origin main`)
- I'll update the milestone checklist
- For milestones: I'll tag and push to trigger CI (`git tag vX.X.X && git push origin vX.X.X`)

## Quick Reference

**Key Files to Read First:**
- `docs/MILESTONES.md` — What to build next
- `docs/PROJECT_STRUCTURE.md` — Where things go
- `docs/ARCHITECTURE.md` — How it works

**Common Tasks:**
- New component? → Check PROJECT_STRUCTURE.md for location
- New feature? → Check MILESTONES.md for acceptance criteria  
- New API? → Check MCP_API.md for contracts
- Confused? → Read ARCHITECTURE.md

**Remember:**
- Fast > perfect (MVP focus)
- Local-first (no cloud dependencies)
- Keyboard-first (optimize for power users)
- Git everything (commit often)

---

*This file is for Claude Code. For user documentation, see QUICK_START.md*