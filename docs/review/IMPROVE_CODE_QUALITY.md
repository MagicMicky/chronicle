# Improvement Plan: Code Quality

**Priority:** High
**Estimated Effort:** 3-4 days
**Impact:** Prevents runtime panics, catches regressions, improves maintainability

---

## Problem Summary

Chronicle's code is well-structured with clean architecture and proper TypeScript strict mode. However, it has zero test coverage across all three modules, `unwrap()` panics in Rust production paths, inconsistent error propagation, and several hardcoded values that should be configurable.

---

## 1. Add Test Suites — HIGH

**Problem:** Zero tests in the entire project. No unit tests, integration tests, or end-to-end tests.

### Course of Action

#### A. Rust Backend Tests

**Where:** `app/src-tauri/src/` — add `#[cfg(test)]` modules to each file.

**Priority test targets:**

1. **Storage module** (`storage/files.rs`, `storage/workspace.rs`):
   ```rust
   #[cfg(test)]
   mod tests {
       use super::*;
       use tempfile::TempDir;

       #[test]
       fn test_read_file_returns_content() {
           let dir = TempDir::new().unwrap();
           let file = dir.path().join("test.md");
           std::fs::write(&file, "# Hello").unwrap();

           let content = read_file(&file).unwrap();
           assert_eq!(content, "# Hello");
       }

       #[test]
       fn test_write_file_atomic_creates_file() { /* ... */ }

       #[test]
       fn test_list_files_excludes_hidden() { /* ... */ }

       #[test]
       fn test_list_files_skips_non_markdown() { /* ... */ }
   }
   ```

2. **Git module** (`git/repo.rs`):
   - Test: `init_or_open_repo` creates `.git` in new directory
   - Test: `commit_file` creates a commit with correct message format
   - Test: `get_file_status` returns correct status

3. **Session tracker** (`session/tracker.rs`):
   - Test: `start_tracking` initializes timer
   - Test: `get_duration` returns elapsed minutes
   - Test: `stop_tracking` returns session info

4. **File parsing** (`commands/file.rs` — `read_processed_file`):
   - Test: Parse markdown with all section types
   - Test: Parse action items with owners
   - Test: Handle missing sections gracefully
   - Test: Handle empty file

Run with: `cd app/src-tauri && cargo test`

#### B. MCP Server Tests

**Where:** `mcp-server/src/` — create `*.test.ts` files alongside source.

**Priority test targets:**

1. **Marker parser** (`processing/parser.ts`):
   ```typescript
   import { describe, it, expect } from "bun:test";
   import { parseMarkers } from "./parser";

   describe("parseMarkers", () => {
     it("should extract highlight markers", () => {
       const result = parseMarkers("> This is important");
       expect(result.highlights).toContain("This is important");
     });

     it("should extract action items", () => {
       const result = parseMarkers("[] Send follow-up email");
       expect(result.actions).toHaveLength(1);
     });

     it("should extract person references", () => {
       const result = parseMarkers("@alice mentioned the deadline");
       expect(result.people).toContain("alice");
     });

     it("should handle empty input", () => {
       const result = parseMarkers("");
       expect(result.highlights).toHaveLength(0);
     });
   });
   ```

2. **Prompt builder** (`processing/prompt-builder.ts`):
   - Test: Each processing style generates different system prompts
   - Test: Focus parameter is included when provided
   - Test: Markers are properly formatted in user message

3. **WebSocket message handling** (`websocket/messages.ts`, `client.ts`):
   - Test: Message serialization/deserialization
   - Test: Timeout handling
   - Test: Reconnection logic (mock WebSocket)

4. **Path validation** (after adding per security plan):
   - Test: Valid paths within workspace pass
   - Test: `../` traversal paths are rejected
   - Test: Absolute paths outside workspace are rejected

Run with: `cd mcp-server && bun test`

#### C. Frontend Component Tests (Lower Priority)

Consider adding Svelte component tests using `@testing-library/svelte` for critical components:
- AI Output state transitions
- File tree rendering
- Processing trigger flow

---

## 2. Remove `unwrap()` from Production Paths — HIGH

**Problem:** 6+ instances of `unwrap()` on fallible operations in command handlers and session tracking.

### Course of Action

**Systematic scan and fix:**

| Location | Current | Fix |
|----------|---------|-----|
| `commands/session.rs:25` | `tracker_state.0.lock().unwrap()` | `.map_err(\|e\| format!("Lock error: {}", e))?` |
| `commands/session.rs:32` | `tracker_state.0.lock().unwrap()` | Same |
| `commands/session.rs:40` | `tracker_state.0.lock().unwrap()` | Same |
| `git/repo.rs:141` | `file_path.strip_prefix(workspace_path).unwrap()` | `.map_err(\|e\| GitError::...(e))?` |
| `session/tracker.rs:44,51,61,72` | `self.current.lock().unwrap()` | Recover from poisoned lock |

**Rule going forward:** Add a clippy lint to catch new `unwrap()` calls:
```toml
# In app/src-tauri/Cargo.toml or clippy.toml
[lints.clippy]
unwrap_used = "warn"
```

---

## 3. Standardize Error Handling — MEDIUM

**Problem:** Errors are handled inconsistently — some logged and swallowed, some returned, some panic.

### Course of Action

1. **Establish error propagation rules:**
   - **Tauri commands**: Always return `Result<T, String>` — never swallow errors
   - **Internal modules**: Use typed errors (`StorageError`, `GitError`)
   - **WebSocket handlers**: Log + return error response to client
   - **MCP tools**: Return `{ isError: true, content: [...] }`

2. **Fix silent error swallowing** in `commands/workspace.rs`:
   ```rust
   // Before: silently logs and continues
   if let Err(e) = create_mcp_config(&app_handle, workspace_path) {
       tracing::warn!("Failed to create .mcp.json: {}", e);
   }

   // After: warn but also inform the user via return value
   let mcp_warning = match create_mcp_config(&app_handle, workspace_path) {
       Ok(_) => None,
       Err(e) => {
           tracing::warn!("Failed to create .mcp.json: {}", e);
           Some(format!("MCP config creation failed: {}", e))
       }
   };
   ```

3. **Add error context** with `.map_err()` at every boundary — never lose the chain:
   ```rust
   // Bad:
   fs::read_to_string(path).map_err(|e| e.to_string())

   // Good:
   fs::read_to_string(path)
       .map_err(|e| format!("Failed to read {}: {}", path.display(), e))
   ```

---

## 4. Replace Hardcoded Values with Configuration — MEDIUM

**Problem:** Several values are embedded in source code that should be configurable.

### Course of Action

| Hardcoded Value | Location | Fix |
|-----------------|----------|-----|
| Port `9847` | `lib.rs:25`, `appstate.rs:40` | Env var `CHRONICLE_WS_PORT` with fallback |
| Model `claude-sonnet-4-20250514` | `process.ts:88` | Env var `CHRONICLE_MODEL` with fallback |
| `max_tokens: 4096` | `process.ts:89` | Env var `CHRONICLE_MAX_TOKENS` with fallback |
| Auto-save debounce `2000ms` | Editor component | Config store |
| Git signature `"Chronicle"` | `git/repo.rs:86` | System username detection |
| WebSocket timeout `30000ms` | `client.ts:128` | Env var or constant file |

Create a `constants.rs` (Rust) and `config.ts` (MCP) for centralized defaults:

```rust
// app/src-tauri/src/constants.rs
pub const DEFAULT_WS_PORT: u16 = 9847;
pub const MAX_FILE_SIZE: u64 = 50 * 1024 * 1024;
pub const DEFAULT_GIT_AUTHOR: &str = "Chronicle";
```

```typescript
// mcp-server/src/config.ts
export const CONFIG = {
  model: process.env.CHRONICLE_MODEL || "claude-sonnet-4-20250514",
  maxTokens: Number(process.env.CHRONICLE_MAX_TOKENS) || 4096,
  wsTimeout: Number(process.env.CHRONICLE_WS_TIMEOUT) || 30000,
} as const;
```

---

## 5. Improve Index-Based String Parsing — LOW

**Where:** `app/src-tauri/src/commands/file.rs:155-165`

**Problem:** Hard-coded string indices for parsing markdown list items can panic on unexpected input.

### Course of Action

Replace index-based slicing with `strip_prefix`:
```rust
// Before (can panic):
let (completed, text_start) = if trimmed.starts_with("- [ ] ") {
    (false, 6)
} else if trimmed.starts_with("- [x] ") {
    (true, 6)
} else if trimmed.starts_with("- ") {
    (false, 2)
};
let text_part = &trimmed[text_start..];

// After (safe):
let (completed, text_part) = if let Some(rest) = trimmed.strip_prefix("- [ ] ") {
    (false, rest)
} else if let Some(rest) = trimmed.strip_prefix("- [x] ")
    .or_else(|| trimmed.strip_prefix("- [X] "))
{
    (true, rest)
} else if let Some(rest) = trimmed.strip_prefix("- ")
    .or_else(|| trimmed.strip_prefix("* "))
{
    (false, rest)
} else {
    (false, trimmed)
};
```

---

## 6. Add Clippy and Lint Enforcement — LOW

### Course of Action

1. **Enable strict clippy lints** in `app/src-tauri/Cargo.toml`:
   ```toml
   [lints.clippy]
   unwrap_used = "warn"
   expect_used = "warn"
   panic = "warn"
   todo = "deny"
   ```

2. **Add ESLint configuration** for MCP server if not present.

3. **Add to CI**: Run `cargo clippy -- -D warnings` and `npm run lint` in GitHub Actions.

---

## 7. Validate WebSocket Messages at Runtime — LOW

**Where:** `mcp-server/src/websocket/client.ts`

**Problem:** Messages are parsed with `JSON.parse` and then cast with `as` — no runtime validation.

### Course of Action

Use Zod to validate incoming messages:
```typescript
import { z } from "zod";

const WsResponseSchema = z.object({
  type: z.literal("response"),
  id: z.string(),
  result: z.unknown().optional(),
  error: z.string().optional(),
});

const WsPushSchema = z.object({
  type: z.literal("push"),
  event: z.string(),
  data: z.unknown().optional(),
});

const WsMessageSchema = z.discriminatedUnion("type", [
  WsResponseSchema,
  WsPushSchema,
]);

// In message handler:
const parsed = WsMessageSchema.safeParse(JSON.parse(data.toString()));
if (!parsed.success) {
  console.error("Invalid WebSocket message:", parsed.error);
  return;
}
const msg = parsed.data;
```

---

## Success Criteria

- [ ] Rust backend has unit tests for storage, git, session, and file parsing modules
- [ ] MCP server has unit tests for parser, prompt builder, and path validation
- [ ] Zero `unwrap()` calls in Tauri command handlers
- [ ] All errors propagated with context (no silent swallowing)
- [ ] Hardcoded values extracted to config/constants
- [ ] Clippy runs clean with `unwrap_used = "warn"`
- [ ] WebSocket messages validated at runtime with Zod
- [ ] CI runs tests and lints on every push
