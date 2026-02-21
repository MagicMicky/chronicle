# Improvement Plan: User Experience

**Priority:** Critical (Process button) + High (other items)
**Estimated Effort:** 3-4 days
**Impact:** Completes the core product flow and makes the app actually usable end-to-end

---

## Problem Summary

Chronicle's core promise — capture notes, process with AI, get structured output — is broken at step 2. There is no in-app way to trigger processing. Users must switch to the terminal and type commands. Additionally, action items are read-only, file discovery is limited, and error recovery is absent.

---

## 1. Add Process Button + Keyboard Shortcut — CRITICAL

**This is the single most important UX fix.** Without it, the app cannot deliver its core value.

### Course of Action

#### A. Status Bar Process Button

Add to the status bar in `app/src/routes/+layout.svelte`:

```svelte
<div class="status-bar">
  <span class="status-file">{currentFileName}</span>
  <span class="status-session">{sessionDuration}</span>

  <div class="status-process">
    <button
      class="process-btn"
      on:click={triggerProcessing}
      disabled={isProcessing || !hasCurrentFile}
    >
      {#if isProcessing}
        <Spinner size={12} /> Processing...
      {:else}
        Process
      {/if}
    </button>
    <select bind:value={processingStyle}>
      <option value="standard">Standard</option>
      <option value="brief">Brief</option>
      <option value="detailed">Detailed</option>
      <option value="focused">Focused</option>
      <option value="structured">Structured</option>
    </select>
  </div>
</div>
```

#### B. Keyboard Shortcut

Register `Cmd+Shift+P` (or `Ctrl+Shift+P` on Linux/Windows) in the global keydown handler:

```typescript
if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'p') {
  e.preventDefault();
  triggerProcessing();
}
```

#### C. Processing Function

Create `app/src/lib/stores/processing.ts`:

```typescript
import { invoke } from '@tauri-apps/api/core';

export async function triggerProcessing(style: string = 'standard') {
  // Get current file from note store
  // Call MCP server via WebSocket (through Tauri command)
  // or invoke a Tauri command that triggers the MCP tool
  await invoke('trigger_processing', { style });
}
```

Add corresponding Rust command in `app/src-tauri/src/commands/`:

```rust
#[tauri::command]
pub async fn trigger_processing(
    style: String,
    state: tauri::State<'_, SharedAppState>,
) -> Result<(), String> {
    // Send WebSocket message to MCP server to trigger processing
    // Or invoke MCP tool directly
}
```

#### D. Processing Feedback

Show processing state in status bar:
- Idle: `[Process ▼]`
- Active: `[Processing... (5s) ×]` with cancel option
- Done: `[Done ✓]` for 3 seconds, then back to idle
- Error: `[Failed — Retry]` in red

---

## 2. Make Action Items Interactive — HIGH

**Where:** `app/src/lib/ai-output/ActionList.svelte`

**Problem:** Checkboxes exist but are disabled. Users see actionable items they can't interact with.

### Course of Action

1. **Enable checkboxes** — remove the `disabled` attribute.

2. **Track completion state** in the AI output store:
   ```typescript
   interface ActionItem {
     text: string;
     owner?: string;
     completed: boolean;  // Now mutable
   }
   ```

3. **Persist completion state** to the `.meta/` JSON file alongside processing metadata.

4. **Visual feedback** on completion:
   - Strikethrough text on completed items
   - Muted color for completed items
   - Count indicator: "3/7 complete"

5. **Add Tauri command** to update action item state:
   ```rust
   #[tauri::command]
   pub async fn update_action_item(
       file_path: String,
       item_index: usize,
       completed: bool,
   ) -> Result<(), String>
   ```

---

## 3. Add Error Recovery — HIGH

**Problem:** When AI processing fails (API error, rate limit, network), users see an error message with only a "Dismiss" button. No way to retry.

### Course of Action

1. **Add "Retry" button** next to error messages in `AIOutput.svelte`:
   ```svelte
   {#if state === 'error'}
     <div class="error-container">
       <p>{errorMessage}</p>
       <div class="error-actions">
         <button on:click={retryProcessing}>Retry</button>
         <button on:click={dismissError}>Dismiss</button>
       </div>
     </div>
   {/if}
   ```

2. **Categorize errors** with actionable guidance:
   - Rate limit: "Rate limited. Retrying in 30s..." (auto-retry with countdown)
   - API key invalid: "API key error. Check your ANTHROPIC_API_KEY."
   - Network error: "Cannot reach API. Check your connection."
   - MCP server disconnected: "Chronicle MCP server not running. Start it with..."

3. **Auto-retry** for transient errors (rate limits, timeouts) with exponential backoff, max 3 attempts.

---

## 4. Enrich File Tree — MEDIUM

**Where:** `app/src/lib/explorer/FileNode.svelte`

**Problem:** File tree shows only names and unsaved/uncommitted status. No dates, no processed indicator, no search.

### Course of Action

1. **Show last-modified time** next to filename:
   ```svelte
   <span class="file-meta">{relativeTime(file.modifiedAt)}</span>
   ```
   Display as "2m ago", "1h ago", "Yesterday", etc.

2. **Processed indicator**: Small icon or badge showing if a `.meta/` file exists for this note:
   - No icon: unprocessed
   - Check icon: processed
   - Stale icon: modified since last processing

3. **Quick search/filter** at top of explorer:
   ```svelte
   <input
     type="text"
     placeholder="Filter files..."
     bind:value={filterText}
   />
   ```
   Filter file tree nodes by name match. Show/hide with `Cmd+F` when explorer is focused.

---

## 5. Add Keyboard Shortcut Guide — MEDIUM

### Course of Action

1. **Create `ShortcutGuide.svelte`** modal component showing all available shortcuts in a grid layout.

2. **Trigger with `Cmd+?`** or `Cmd+/`:
   ```
   Navigation
     Cmd+B          Toggle Explorer
     Cmd+Shift+A    Toggle AI Output
     Cmd+`          Focus Terminal
     Cmd+N          New Note

   Processing
     Cmd+Shift+P    Process Current Note

   Editor
     Cmd+B          Bold
     Cmd+I          Italic
     Cmd+`          Code
     Cmd+K          Link
   ```

3. **Include in Help menu** or as a tooltip on the status bar.

---

## 6. Improve Status Bar — MEDIUM

**Where:** `app/src/routes/+layout.svelte`

**Problem:** The 24px status bar shows minimal information.

### Course of Action

Redesign status bar with three zones:

```
[left: file info]              [center: process controls]        [right: session info]
📄 meeting-notes.md (2.3kb)   [Standard ▼] [Process]           Session: 32m | Saved ✓
```

- **Left**: Current filename, file size, git status (saved/modified/uncommitted)
- **Center**: Processing style dropdown + process button + state indicator
- **Right**: Session duration, save status, word count

---

## 7. Add Command Palette — LONG TERM

A VS Code-style command palette (`Cmd+Shift+P` or dedicate a different shortcut if `Cmd+Shift+P` is for processing) that surfaces all app actions:

```
> Process Note (Standard)
> Process Note (Brief)
> Process Note (Detailed)
> New Note
> Open Workspace
> Toggle Explorer
> Toggle AI Output
> View Shortcuts
> End Session
```

This could replace the need for remembering individual shortcuts and makes the app more discoverable.

---

## Success Criteria

- [ ] Users can trigger AI processing without leaving the editor (button or shortcut)
- [ ] Processing state is visible in status bar at all times
- [ ] Failed processing shows actionable error with retry option
- [ ] Action item checkboxes are interactive with persisted state
- [ ] File tree shows modification time and processed status
- [ ] Keyboard shortcut guide accessible via Cmd+?
- [ ] Status bar shows file info, processing state, and session duration
