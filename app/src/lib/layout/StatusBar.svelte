<script lang="ts">
  import { saveStatus, type SaveStatus } from '$lib/stores/autosave';
  import { noteTitle, isNoteDirty, hasOpenNote } from '$lib/stores/note';
  import { hasWorkspace, currentWorkspace } from '$lib/stores/workspace';

  // Use $ prefix to subscribe to stores reactively
  $: status = $saveStatus;
  $: dirty = $isNoteDirty;
  $: title = $noteTitle;
  $: noteOpen = $hasOpenNote;
  $: workspaceOpen = $hasWorkspace;
  $: workspaceName = $currentWorkspace?.name ?? '';

  // Reactive status text
  $: statusText = getStatusText(status, dirty, noteOpen);

  function getStatusText(s: SaveStatus, isDirty: boolean, hasNote: boolean): string {
    if (s === 'saving') return 'Saving...';
    if (s === 'saved') return 'Saved';
    if (s === 'error') return 'Save failed';
    if (isDirty) return 'Unsaved changes';
    if (hasNote) return 'Ready';
    return 'No file open';
  }
</script>

<div class="status-bar">
  <div class="status-left">
    <span class="status-item">
      {#if noteOpen}
        {title}
      {:else if workspaceOpen}
        {workspaceName}
      {:else}
        Chronicle
      {/if}
    </span>
  </div>
  <div class="status-center">
    <span class="status-item" class:saving={status === 'saving'} class:error={status === 'error'} class:dirty={dirty}>
      {statusText}
    </span>
  </div>
  <div class="status-right">
    <span class="status-item">v0.3.0</span>
  </div>
</div>

<style>
  .status-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 24px;
    background: var(--status-bg, #1a1a1a);
    border-top: 1px solid var(--border-color, #333);
    padding: 0 12px;
    font-size: 12px;
    color: var(--text-muted, #888);
  }

  .status-left,
  .status-center,
  .status-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .status-left {
    flex: 1;
    min-width: 0;
  }

  .status-left .status-item {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .status-item.saving {
    color: var(--accent-color, #0078d4);
  }

  .status-item.error {
    color: var(--error-color, #f44336);
  }

  .status-item.dirty {
    color: var(--warning-color, #cca700);
  }
</style>
