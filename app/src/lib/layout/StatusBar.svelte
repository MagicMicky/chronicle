<script lang="ts">
  import { saveStatus, type SaveStatus } from '$lib/stores/autosave';
  import { noteTitle, isNoteDirty, hasOpenNote } from '$lib/stores/note';
  import { hasWorkspace, currentWorkspace } from '$lib/stores/workspace';
  import {
    sessionState as sessionStateStore,
    sessionDuration as sessionDurationStore,
    annotationCount as annotationCountStore,
    formatDuration,
    type SessionStateType,
  } from '$lib/stores/session';

  // Use $ prefix to subscribe to stores reactively
  $: status = $saveStatus;
  $: dirty = $isNoteDirty;
  $: title = $noteTitle;
  $: noteOpen = $hasOpenNote;
  $: workspaceOpen = $hasWorkspace;
  $: workspaceName = $currentWorkspace?.name ?? '';
  $: state = $sessionStateStore;
  $: duration = $sessionDurationStore;
  $: annotations = $annotationCountStore;

  // Reactive status text
  $: statusText = getStatusText(status, dirty, noteOpen);

  // Session display text
  $: sessionDisplay = getSessionDisplay(state, duration, annotations);

  function getStatusText(s: SaveStatus, isDirty: boolean, hasNote: boolean): string {
    if (s === 'saving') return 'Saving...';
    if (s === 'saved') return 'Saved';
    if (s === 'error') return 'Save failed';
    if (isDirty) return 'Unsaved changes';
    if (hasNote) return 'Ready';
    return 'No file open';
  }

  function getSessionDisplay(
    sessionState: SessionStateType,
    durationMinutes: number,
    annotationCount: number
  ): string {
    if (sessionState === 'inactive') {
      return '';
    }

    const durationStr = formatDuration(durationMinutes);

    if (sessionState === 'active') {
      return `(${durationStr})`;
    }

    // Session ended
    if (annotationCount > 0) {
      return `(${durationStr}) +${annotationCount} annotation${annotationCount > 1 ? 's' : ''}`;
    }
    return `(${durationStr})`;
  }
</script>

<div class="status-bar">
  <div class="status-left">
    <span class="status-item">
      {#if noteOpen}
        {title}
        {#if sessionDisplay}
          <span class="session-info" class:active={state === 'active'} class:ended={state === 'ended'}>
            {sessionDisplay}
          </span>
        {/if}
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
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    height: 24px;
    min-height: 24px;
    max-height: 24px;
    flex-shrink: 0;
    background: var(--status-bg, #1a1a1a);
    border-top: 1px solid var(--border-color, #333);
    padding: 0 12px;
    font-size: 12px;
    color: var(--text-muted, #888);
    box-sizing: border-box;
  }

  .status-left,
  .status-center,
  .status-right {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 12px;
    white-space: nowrap;
  }

  .status-left {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    justify-content: flex-start;
  }

  .status-center {
    flex: 0 0 auto;
  }

  .status-right {
    flex: 1;
    min-width: 0;
    justify-content: flex-end;
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

  .session-info {
    margin-left: 8px;
    opacity: 0.7;
  }

  .session-info.active {
    color: var(--accent-color, #0078d4);
    opacity: 1;
  }

  .session-info.ended {
    color: var(--text-muted, #888);
  }
</style>
