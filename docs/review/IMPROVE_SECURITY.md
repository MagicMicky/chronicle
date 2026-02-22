# Improvement Plan: Security

**Priority:** Critical
**Estimated Effort:** 2-3 days
**Impact:** Prevents path traversal, command injection, and DoS vulnerabilities

---

## Problem Summary

Chronicle has critical input validation gaps in both the Rust backend and MCP server. User-controlled file paths are not validated against workspace boundaries, git commands use string interpolation with unsanitized input, and there are no size limits on file operations or WebSocket messages. While the local-first architecture reduces attack surface, the MCP server processes input from Claude (which processes user prompts), creating an indirect injection vector.

---

## 1. Fix Path Traversal (Rust Backend) — CRITICAL

**Where:** `app/src-tauri/src/commands/file.rs`, `commands/workspace.rs`

**Problem:** `read_file`, `write_file`, and `read_processed_file` accept arbitrary paths without workspace boundary validation.

### Course of Action

1. **Create a path validation utility** in `app/src-tauri/src/storage/validate.rs`:
   ```rust
   use std::path::{Path, PathBuf};

   pub fn validate_workspace_path(
       workspace: &Path,
       target: &Path,
   ) -> Result<PathBuf, String> {
       let canonical_workspace = workspace.canonicalize()
           .map_err(|e| format!("Invalid workspace: {}", e))?;

       // Resolve the target relative to workspace if not absolute
       let resolved = if target.is_absolute() {
           target.to_path_buf()
       } else {
           workspace.join(target)
       };

       let canonical_target = resolved.canonicalize()
           .map_err(|e| format!("Invalid path: {}", e))?;

       if !canonical_target.starts_with(&canonical_workspace) {
           return Err("Path is outside workspace".to_string());
       }

       Ok(canonical_target)
   }
   ```

2. **Apply validation** in every file command before performing I/O. The workspace path should be retrieved from app state and used as the boundary.

3. **Add symlink protection** in `storage/workspace.rs`:
   ```rust
   WalkDir::new(workspace_path)
       .follow_links(false)  // Don't follow symlinks
   ```

4. **For paths that don't exist yet** (new files), validate the parent directory instead of the file itself.

---

## 2. Fix Path Traversal (MCP Server) — CRITICAL

**Where:** `mcp-server/src/tools/process.ts:68`

**Problem:** `path.join(workspacePath, input.path)` does not prevent `../` traversal.

### Course of Action

1. **Add validation before any file operation**:
   ```typescript
   import path from "path";

   function validateWorkspacePath(workspace: string, target: string): string {
     const resolved = path.resolve(workspace, target);
     const normalized = path.normalize(resolved);

     if (!normalized.startsWith(workspace + path.sep) && normalized !== workspace) {
       throw new Error("Path must be within workspace");
     }

     return normalized;
   }
   ```

2. **Apply in `process.ts`** before `readFile`:
   ```typescript
   filePath = validateWorkspacePath(workspacePath, input.path);
   ```

3. **Apply in `history.ts`** before all git operations on file paths.

---

## 3. Fix Command Injection (MCP Server) — CRITICAL

**Where:** `mcp-server/src/tools/history.ts`

**Problem:** `execSync` uses string interpolation with `input.commit` and `input.path`, enabling shell injection.

### Course of Action

1. **Replace `execSync` with `execFileSync`** which takes arguments as an array (no shell interpretation):
   ```typescript
   import { execFileSync } from "child_process";

   // Before (vulnerable):
   execSync(`git log --pretty=format:"%h|%s|%ar" -n ${limit} -- "${relativePath}"`, { cwd });

   // After (safe):
   execFileSync("git", [
     "log",
     `--pretty=format:%h|%s|%ar`,
     "-n", String(limit),
     "--", relativePath
   ], { cwd, encoding: "utf-8" });
   ```

2. **Validate commit hashes** with a regex before use:
   ```typescript
   function validateCommitRef(ref: string): string {
     // Allow: hex hashes, HEAD~N, branch names (alphanumeric + /._-)
     if (!/^[a-zA-Z0-9._\-\/~^]+$/.test(ref)) {
       throw new Error("Invalid commit reference");
     }
     return ref;
   }
   ```

3. **Validate numeric limits**:
   ```typescript
   const limit = Math.min(Math.max(Number(input.limit) || 10, 1), 100);
   ```

4. **Apply to all four git tool functions**: `get_history`, `get_version`, `compare_versions`.

---

## 4. Fix Mutex Panics (Rust Backend) — HIGH

**Where:** `app/src-tauri/src/commands/session.rs`, `session/tracker.rs`

**Problem:** `Mutex::lock().unwrap()` panics if another thread poisoned the lock.

### Course of Action

Replace all `unwrap()` on lock acquisition with proper error handling:

```rust
// Before:
let manager = tracker_state.0.lock().unwrap();

// After:
let manager = tracker_state.0.lock()
    .map_err(|e| format!("Session lock error: {}", e))?;
```

For the `tracker.rs` internal methods that don't return `Result`, recover from poisoned locks:
```rust
let mut current = match self.current.lock() {
    Ok(guard) => guard,
    Err(poisoned) => {
        tracing::warn!("Recovering from poisoned session lock");
        poisoned.into_inner()
    }
};
```

---

## 5. Add Input Size Limits — HIGH

**Where:** `app/src-tauri/src/commands/file.rs`, `websocket/server.rs`

### Course of Action

1. **File size limits** on read/write commands:
   ```rust
   const MAX_FILE_SIZE: u64 = 50 * 1024 * 1024; // 50MB

   pub async fn read_file(path: String) -> Result<String, String> {
       let metadata = std::fs::metadata(&path)
           .map_err(|e| format!("Cannot access file: {}", e))?;
       if metadata.len() > MAX_FILE_SIZE {
           return Err(format!("File exceeds {}MB limit", MAX_FILE_SIZE / 1024 / 1024));
       }
       // ... proceed
   }
   ```

2. **WebSocket message size limits**:
   ```rust
   // In websocket/server.rs, configure tungstenite with max message size
   let ws_config = tungstenite::protocol::WebSocketConfig {
       max_message_size: Some(10 * 1024 * 1024), // 10MB
       max_frame_size: Some(2 * 1024 * 1024),     // 2MB
       ..Default::default()
   };
   ```

3. **MCP server input length limits** — add `z.string().max(4096)` to path inputs in Zod schemas.

---

## 6. Fix Race Condition in Setup — MEDIUM

**Where:** `app/src-tauri/src/lib.rs:36-46`

**Problem:** App handle is stored asynchronously — Tauri events emitted before completion are lost.

### Course of Action

Make the setup synchronous:
```rust
.setup(move |app| {
    let app_handle = app.handle().clone();
    let state_clone = app_state.clone();

    // Block until handle is stored
    let rt = tokio::runtime::Handle::current();
    rt.block_on(async {
        let mut state = state_clone.write().await;
        state.app_handle = Some(app_handle);
    });

    tracing::info!("App handle stored in WebSocket app state");
    Ok(())
})
```

---

## 7. Improve CSP Headers — MEDIUM

**Where:** `app/src-tauri/tauri.conf.json`

### Course of Action

Replace `'unsafe-inline'` with nonce-based style loading:
```json
{
  "security": {
    "csp": "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'"
  }
}
```

If inline styles are required by CodeMirror or xterm.js, use a hash-based allowlist rather than blanket `'unsafe-inline'`.

---

## 8. Secure .mcp.json File Permissions — MEDIUM

**Where:** `app/src-tauri/src/commands/workspace.rs:73-135`

### Course of Action

On Unix systems, restrict file permissions:
```rust
#[cfg(unix)]
{
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(&mcp_path, std::fs::Permissions::from_mode(0o600))
        .map_err(|e| format!("Failed to set permissions: {}", e))?;
}
```

---

## 9. Add WebSocket Origin Validation — LOW

**Where:** `app/src-tauri/src/websocket/server.rs`

### Course of Action

Validate WebSocket upgrade request headers:
```rust
// During handshake, verify origin is from expected source
fn validate_origin(request: &Request) -> bool {
    // Only accept connections from known MCP server
    // In local-first app, this is defense-in-depth
    true // For now, localhost binding is sufficient
}
```

This is low priority because localhost binding already limits connections to the local machine.

---

## 10. Reduce Sensitive Data in Logs — LOW

**Where:** Multiple files

### Course of Action

Replace path logging with presence indicators:
```rust
// Before:
tracing::debug!("Reading file: {}", path);

// After:
tracing::debug!("Reading file (length={})", path.len());
// Or at trace level only:
tracing::trace!("Reading file: {}", path);
```

---

## Verification Checklist

- [ ] No file operation accepts paths without workspace boundary validation
- [ ] No `execSync` with string interpolation of user input
- [ ] No `unwrap()` on Mutex locks in command handlers
- [ ] File operations reject files over size limit
- [ ] WebSocket messages have size caps
- [ ] Commit refs validated against safe pattern
- [ ] Symlinks not followed in file tree listing
- [ ] .mcp.json has restricted file permissions
- [ ] CSP does not include `'unsafe-inline'`
- [ ] No sensitive file paths in DEBUG-level logs
