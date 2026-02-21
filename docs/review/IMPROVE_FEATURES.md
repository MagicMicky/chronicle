# Improvement Plan: Features

**Priority:** High (Process trigger), Medium (others)
**Estimated Effort:** 5-8 days total
**Impact:** Completes M7, enables product launch, lays groundwork for Phase 2

---

## Problem Summary

Chronicle's feature set is 70% complete. The core capture and display pipeline works, but the critical trigger mechanism (Process button) is missing. Beyond that, several features would elevate the product from "functional prototype" to "compelling tool": cross-note search, interactive action tracking, and a settings UI.

---

## 1. In-App Processing Trigger — CRITICAL (M7 Blocker)

**Problem:** The entire product value chain breaks without an in-app way to trigger AI processing.

### Course of Action

This is the same as UX item #1 (see `IMPROVE_UX.md`), but from a feature architecture perspective:

#### Backend: New Tauri Command

Create `app/src-tauri/src/commands/processing.rs`:

```rust
#[tauri::command]
pub async fn trigger_processing(
    style: String,
    app_state: tauri::State<'_, SharedAppState>,
) -> Result<(), String> {
    let state = app_state.read().await;
    let file_path = state.current_file_path
        .as_ref()
        .ok_or("No file is currently open")?;

    // Send processing request via WebSocket to MCP server
    let ws_msg = serde_json::json!({
        "type": "request",
        "id": uuid::Uuid::new_v4().to_string(),
        "method": "triggerProcessing",
        "data": {
            "path": file_path,
            "style": style
        }
    });

    // Broadcast to connected MCP server
    // The MCP server will call process_meeting tool internally
    broadcast_ws_message(&ws_msg).await
        .map_err(|e| format!("Failed to trigger processing: {}", e))
}
```

#### MCP Server: Handle Processing Request

Add handler in `mcp-server/src/websocket/client.ts` for incoming processing triggers from the app. The MCP server then invokes its own `process_meeting` tool logic.

#### Frontend: Processing Store

Create `app/src/lib/stores/processing.ts` to manage processing lifecycle:

```typescript
import { writable, derived } from 'svelte/store';

type ProcessingState = 'idle' | 'processing' | 'success' | 'error';

export const processingState = writable<ProcessingState>('idle');
export const processingStyle = writable<string>('standard');
export const processingError = writable<string | null>(null);
export const processingStartTime = writable<number | null>(null);

export const processingDuration = derived(
  processingStartTime,
  ($start) => $start ? Math.floor((Date.now() - $start) / 1000) : 0
);
```

---

## 2. Cross-Note Search — HIGH (Phase 2 Foundation)

**Problem:** Users can only find notes by browsing the file tree. No keyword search, no quick-jump.

### Course of Action

#### A. Quick File Jump (Cmd+P)

A VS Code-style file picker that fuzzy-matches filenames:

1. Create `app/src/lib/components/QuickOpen.svelte` — modal with text input and filtered file list
2. On `Cmd+P`, show modal with all markdown files from workspace
3. Fuzzy match as user types (use a simple scoring algorithm or `fuse.js`)
4. Enter opens the selected file
5. Escape closes modal

#### B. Full-Text Search (Cmd+Shift+F)

Search across all notes in workspace:

1. **Rust command** to search file contents:
   ```rust
   #[tauri::command]
   pub async fn search_workspace(
       workspace: String,
       query: String,
   ) -> Result<Vec<SearchResult>, String> {
       // Walk workspace, grep files, return matches with context
   }
   ```

2. **Search results panel** replacing or augmenting the explorer:
   - Show filename, line number, and surrounding context
   - Click result to open file at that line
   - Highlight search terms in results

#### C. MCP-Powered Semantic Search (Future)

Use Claude to find notes by meaning, not just keywords:
- "Find notes about the Q4 planning discussion"
- "What did Sarah say about the migration timeline?"

This requires embeddings or a Claude query tool — defer to Phase 3.

---

## 3. Action Item Dashboard — MEDIUM (Phase 2)

**Problem:** Action items are extracted per-note but there's no unified view across all notes.

### Course of Action

1. **New pane or tab** in AI Output area: "Actions" tab alongside current output.

2. **Aggregate action items** from all `.meta/` files in workspace:
   ```typescript
   interface DashboardAction {
     text: string;
     owner?: string;
     completed: boolean;
     sourceFile: string;
     processedAt: string;
   }
   ```

3. **Filter and sort**:
   - Filter by: owner, completion status, source file
   - Sort by: date processed, owner, completion
   - Group by: source file, owner

4. **Rust command** to scan `.meta/` directory:
   ```rust
   #[tauri::command]
   pub async fn get_all_actions(workspace: String) -> Result<Vec<DashboardAction>, String>
   ```

---

## 4. Note Templates — MEDIUM (Phase 2)

**Problem:** Users start from blank notes every time. Templates would reduce friction for common meeting types.

### Course of Action

1. **Template files** stored in workspace `.templates/` directory:
   ```markdown
   # 1:1 with {name}
   ## Updates
   >

   ## Discussion
   >

   ## Action Items
   []

   ## Follow-ups
   ?
   ```

2. **Template selection** when creating new note (Cmd+N shows template picker).

3. **Built-in templates**: 1:1, Team Sync, Interview, Planning, Retrospective.

4. **Custom templates**: Users create their own in `.templates/`.

---

## 5. Settings UI — MEDIUM

**Problem:** All configuration is file-based or hardcoded. Users can't customize their experience.

### Course of Action

1. **Settings modal** accessible via Cmd+, (standard shortcut):

   ```
   General
     Workspace path: [/path/to/workspace]  [Change]
     Theme: [Dark ▼] / [Light ▼] / [System ▼]

   Editor
     Font size: [14px]
     Font family: [JetBrains Mono]
     Line wrapping: [On / Off]
     Tab size: [2 / 4]

   Processing
     Default style: [Standard ▼]
     Model: [claude-sonnet-4 ▼]

   Session
     Auto-end after inactivity: [15 min]
     Auto-save interval: [2 sec]

   Markers
     > Highlight color: [#color]
     ! Decision color: [#color]
     ? Question color: [#color]
     [] Action color: [#color]
     @ Person color: [#color]
   ```

2. **Persist settings** to `~/.chronicle/config.json` or workspace `.chronicle/config.json`.

3. **Runtime application** — settings changes take effect immediately without restart.

---

## 6. Processing Style Selection UI — HIGH

**Problem:** Users can't choose processing style from the UI. The five styles (standard, brief, detailed, focused, structured) are only accessible via MCP tool parameters.

### Course of Action

1. **Dropdown in status bar** next to Process button (see UX plan).

2. **Style descriptions** shown on hover or in settings:
   - **Standard**: Balanced summary with all sections
   - **Brief**: Quick TL;DR + action items only
   - **Detailed**: Comprehensive analysis with full context
   - **Focused**: Emphasis on decisions and action items for 1:1s
   - **Structured**: Formal format for compliance/documentation

3. **Remember last-used style** per workspace in settings.

---

## 7. Export Capabilities — LOW (Phase 2+)

**Problem:** Processed output is trapped in the app. Users can't easily share or reference it outside Chronicle.

### Course of Action

1. **Copy to clipboard** button on AI Output sections (individual sections or full output).

2. **Export to markdown** — save processed output as a standalone `.md` file.

3. **Export to PDF** — render processed output as a formatted PDF (using browser print or a PDF library).

---

## Feature Roadmap Summary

| Feature | Priority | Milestone | Effort |
|---------|----------|-----------|--------|
| Process button + shortcut | Critical | M7 | 1 day |
| Processing style dropdown | High | M7 | 0.5 day |
| Error recovery + retry | High | M7 | 0.5 day |
| Quick file jump (Cmd+P) | High | M8 | 1 day |
| Full-text search | High | M8 | 2 days |
| Interactive action items | High | M8 | 1 day |
| Action item dashboard | Medium | Phase 2 | 2 days |
| Note templates | Medium | Phase 2 | 1 day |
| Settings UI | Medium | Phase 2 | 2 days |
| Export capabilities | Low | Phase 2 | 1 day |
| Semantic search | Low | Phase 3 | TBD |

---

## Success Criteria

- [ ] AI processing triggerable from keyboard shortcut and UI button
- [ ] Processing style selectable from dropdown
- [ ] Quick file jump works with fuzzy matching
- [ ] Full-text search returns results with context
- [ ] Action items interactive with persistent completion state
- [ ] At least 3 built-in note templates available
- [ ] Basic settings UI for theme, font, and processing defaults
