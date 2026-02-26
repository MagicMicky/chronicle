# Code Review: Chronicle v0.6.0

**Date**: 2026-02-21
**Scope**: Full codebase — Svelte frontend, Rust backend, MCP server, configuration

## Overall Assessment

Chronicle is a well-structured project with clean separation of concerns across three layers (Svelte frontend, Rust backend, TypeScript MCP server). The M0–M5 foundation is solid. However, there are **3 critical security issues** in the MCP server, several error-handling gaps, and meaningful UX improvements needed before user-readiness.

---

## CRITICAL: Security Vulnerabilities (MCP Server)

These must be fixed before any release.

### 1. Shell Injection in Git Commands

- **Files**: `mcp-server/src/tools/history.ts:79,84,107-108`
- **Problem**: User-provided `commit`, `fromCommit`, and `toCommit` values are interpolated directly into shell commands via `execSync()`. An attacker could pass `"; rm -rf /"` as a commit hash.
- **Fix**: Use `execFileSync` (array form) instead of `execSync` with string interpolation, or validate inputs against a strict commit-hash regex (`/^[a-f0-9]{4,40}$/`).

### 2. Path Traversal in process_meeting

- **File**: `mcp-server/src/tools/process.ts:68`
- **Problem**: `path.join(workspacePath, input.path)` allows `../../etc/passwd`.
- **Fix**: Resolve the path and assert it starts with the workspace directory.

### 3. Prompt Injection via Focus Parameter

- **File**: `mcp-server/src/processing/prompt-builder.ts:80`
- **Problem**: The user-provided `focus` string is concatenated directly into the Claude API prompt.
- **Fix**: Sanitize or structurally separate user input from system instructions (e.g., use a dedicated `user` message role for the focus parameter).

---

## Rust Backend Issues

### Error Handling

- `app/src-tauri/src/commands/session.rs:25,32,40` — `lock().unwrap()` on mutexes can panic if the lock is poisoned. Use `.lock().map_err(|e| format!("Lock poisoned: {e}"))` instead.
- All Tauri commands convert errors to `String`, losing type information. A unified error enum would improve diagnostics.

### Architecture

- `app/src-tauri/src/websocket/server.rs:151` — Uses `std::thread::spawn` instead of Tokio tasks for WebSocket handling. Since the app already runs Tokio, this creates an unnecessary thread.
- Multiple `#[allow(dead_code)]` annotations on fields intended for future milestones. These should be cleaned up or gated behind feature flags.

### Dead Code

- `app/src-tauri/src/git/repo.rs:103` — `Process`, `Annotate`, `Snapshot` enum variants
- `app/src-tauri/src/git/repo.rs:213` — Dirty-checking function
- `app/src-tauri/src/storage/metadata.rs:69` — Session data fields

---

## Frontend Issues

### Production Logging Violations

- `app/src/lib/stores/autosave.ts:33,36,52,57,73,105,109,113` and other stores contain `console.log()` calls. CLAUDE.md explicitly says "No `console.log` in production."

### Hardcoded Version

- `app/src/lib/layout/StatusBar.svelte:54` — Version is hardcoded as `v0.4.1` (stale — current version is 0.6.0). Should be pulled from `package.json` or Tauri config at build time.

### Store Subscription Patterns

- `StatusBar.svelte`, `Panes.svelte`, `Explorer.svelte` use manual `.subscribe()` patterns instead of Svelte 5 runes (`$effect`). This works but is not idiomatic and creates cleanup burden.

### Error Visibility

- Auto-save errors are caught and logged but never surfaced to the user in the UI (`app/src/lib/stores/autosave.ts:93`). The StatusBar shows an "error" state but only passively.
- Terminal PTY spawn failures show a one-time message with no retry mechanism (`app/src/lib/terminal/Terminal.svelte:121-149`).

### Accessibility Gaps

- `app/src/lib/explorer/FileNode.svelte:26-31` — File tree only handles Enter/Space but not Arrow keys for tree navigation.
- Emoji icons used as visual indicators lack `aria-label` attributes.
- Pane collapse buttons missing `aria-expanded` state.

### Repeated Patterns Needing Extraction

- `e instanceof Error ? e.message : String(e)` appears in workspace.ts, session.ts, autosave.ts, fileStatus.ts, terminal.ts. Extract to a utility.
- Magic numbers for pane constraints in `ui.ts:31,33,35` (150, 500, 200, 600) should be named constants.

---

## MCP Server Issues (Beyond Security)

### Memory Leaks

- `mcp-server/src/websocket/client.ts:128-133` — Timeout promises for WebSocket requests are never cleaned up on success. The pending requests map (line 21) grows unboundedly on failures.

### Missing Runtime Validation

- `mcp-server/src/websocket/client.ts:44` — `JSON.parse()` result cast with `as WsResponse` without Zod validation (Zod is already a dependency but unused here).

### Hardcoded Model

- `mcp-server/src/tools/process.ts:88,133` — Claude model version `"claude-sonnet-4-20250514"` is hardcoded. Should be configurable via environment variable.

### Non-Transactional File Writes

- `mcp-server/src/tools/process.ts:110-148` — Writes raw backup, then content, then metadata sequentially. If metadata write fails, the file is modified but metadata is missing.

### Regex Limitation

- `mcp-server/src/processing/parser.ts:44` — `@(\w+)` breaks with non-ASCII names (e.g., `@José:`).

### Dead Code

- `mcp-server/src/websocket/messages.ts:21` — `WsMessage` type defined but never used.

---

## User-Friendliness Improvements

1. **Error notifications** — Users currently have no visible feedback when auto-save fails, WebSocket disconnects, or processing errors occur. Add a toast/notification system.

2. **Onboarding / empty state** — When a user opens Chronicle for the first time with no workspace, there's no guided flow. Add an empty state with "Open Workspace" / "Create New Workspace" prompts and marker explanations.

3. **Keyboard shortcut discoverability** — Shortcuts exist but aren't documented in-app. Add a help panel (Cmd+?) or tooltip hints.

4. **Processing feedback** — The AI Output pane is a placeholder. Users who trigger `process_meeting` get no visual feedback.

5. **File tree keyboard navigation** — Arrow key navigation is missing. Power users expect to navigate trees entirely by keyboard.

6. **Marker documentation** — New users won't know what `>`, `!`, `?`, `[]`, `@` mean. Consider inline hints or a quick-reference tooltip.

7. **Version display** — StatusBar shows stale `v0.4.1`. Auto-sync from build config.

8. **Terminal retry** — If PTY spawn fails, users must restart the app. Add a "Retry" button.

---

## Recommended Next Steps (Priority Order)

### Immediate (before any release)

1. Fix the 3 critical security vulnerabilities in the MCP server
2. Replace `lock().unwrap()` with proper error handling in Rust session commands
3. Remove all `console.log()` from production frontend code

### M6 Completion (AI Output Pane)

4. Build the Summary, KeyPoints, ActionList, and Questions UI components
5. Connect to `aiOutput` store and `processingComplete` push events
6. Add processing state indicators (ready/processing/complete/error)

### Quality-of-Life

7. Add toast/notification system for error visibility
8. Fix hardcoded version string — derive from build config
9. Add Zod runtime validation for WebSocket messages in MCP server
10. Clean up timeout/request memory leaks in WebSocket client
11. Extract repeated error-handling pattern to utility function
12. Make Claude model version configurable via env var

### UX Polish (M7 Territory)

13. Implement keyboard arrow-key navigation for file tree
14. Add onboarding empty state for first-time users
15. Add keyboard shortcut help panel
16. Add marker quick-reference documentation in-app
17. Modernize store subscriptions to Svelte 5 runes
