<script lang="ts">
  import { saveStatus, lastSaved, saveError, type SaveStatus } from '$lib/stores/autosave';
  import { noteTitle, isNoteDirty, hasOpenNote, noteContent, currentNote } from '$lib/stores/note';
  import { hasWorkspace, currentWorkspace } from '$lib/stores/workspace';

  import {
    isAIProcessing,
    aiOutputStore,
    isMcpConnected,
  } from '$lib/stores/aiOutput';
  import { claudeInstalled } from '$lib/stores/claudeStatus';
  import { invoke } from '@tauri-apps/api/core';
  import { fileStatuses } from '$lib/stores/fileStatus';
  import { isAgentsRunning, lastAgentRun } from '$lib/stores/agentStatus';
  import { Sun, Moon, Check, Loader2, Pencil, AlertTriangle, Brain } from 'lucide-svelte';
  import { onDestroy } from 'svelte';

  let theme = 'dark';

  // Initialize theme from DOM on component creation
  if (typeof document !== 'undefined') {
    theme = document.documentElement.getAttribute('data-theme') || 'dark';
  }

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('chronicle-theme', theme);
  }

  // Use $ prefix to subscribe to stores reactively
  $: status = $saveStatus;
  $: dirty = $isNoteDirty;
  $: title = $noteTitle;
  $: noteOpen = $hasOpenNote;
  $: workspaceOpen = $hasWorkspace;
  $: workspaceName = $currentWorkspace?.name ?? '';
  $: processing = $isAIProcessing;
  $: content = $noteContent;
  $: workspace = $currentWorkspace;
  $: note = $currentNote;
  $: statuses = $fileStatuses;
  $: saved = $lastSaved;
  $: error = $saveError;
  $: mcpConnected = $isMcpConnected;
  $: claude = $claudeInstalled;
  $: agentsRunning = $isAgentsRunning;
  $: lastAgentsRun = $lastAgentRun;

  // Relative time display
  let relativeTime = '';
  let relativeTimer: ReturnType<typeof setInterval> | null = null;

  function formatRelativeTime(date: Date | null): string {
    if (!date) return '';
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 10) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }

  $: if (saved) {
    relativeTime = formatRelativeTime(saved);
  } else {
    relativeTime = '';
  }

  // Update relative time every 30s
  relativeTimer = setInterval(() => {
    if (saved) {
      relativeTime = formatRelativeTime(saved);
    }
  }, 30000);

  onDestroy(() => {
    if (relativeTimer) clearInterval(relativeTimer);
  });

  // Effective display status: use 'dirty' from store, or infer from isDirty flag
  $: displayStatus = getDisplayStatus(status, dirty, noteOpen);

  // Word count for current note
  $: wordCount = noteOpen && content
    ? content.trim().split(/\s+/).filter((w: string) => w.length > 0).length
    : 0;

  // Git status for current file
  $: gitStatus = note?.path ? statuses.getStatus(note.path) : 'clean';

  function getDisplayStatus(s: SaveStatus, isDirty: boolean, hasNote: boolean): SaveStatus | 'none' {
    if (!hasNote) return 'none';
    if (s === 'saving') return 'saving';
    if (s === 'error') return 'error';
    if (s === 'dirty' || isDirty) return 'dirty';
    if (s === 'saved') return 'saved';
    return 'saved'; // idle with a note open = saved
  }

  function getStatusText(s: SaveStatus | 'none'): string {
    switch (s) {
      case 'saving': return 'Saving...';
      case 'saved': return 'Saved';
      case 'error': return 'Save failed';
      case 'dirty': return 'Edited';
      case 'none': return '';
      default: return '';
    }
  }

  async function handleProcess() {
    if (!note?.path || !workspace?.path) return;
    aiOutputStore.setProcessing(true);
    try {
      await invoke('process_note', { workspacePath: workspace.path, notePath: note.path });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      aiOutputStore.setError(msg);
    }
  }
</script>

<div class="status-bar">
  <div class="status-left">
    <span class="status-item">
      {#if noteOpen}
        <span
          class="git-dot"
          class:committed={gitStatus === 'clean'}
          class:uncommitted={gitStatus === 'uncommitted' || gitStatus === 'unsaved'}
          title="Git: {gitStatus}"
        ></span>
        {title}
        {#if wordCount > 0}
          <span class="word-count">{wordCount} words</span>
        {/if}
      {:else if workspaceOpen}
        {workspaceName}
      {:else}
        Chronicle
      {/if}
    </span>
  </div>
  <div class="status-center">
    {#if displayStatus !== 'none'}
      <span
        class="status-item save-indicator"
        class:saving={displayStatus === 'saving'}
        class:saved={displayStatus === 'saved'}
        class:error={displayStatus === 'error'}
        class:dirty={displayStatus === 'dirty'}
        title={displayStatus === 'error' && error ? error : ''}
      >
        {#if displayStatus === 'saving'}
          <Loader2 size={12} class="spin-icon" />
        {:else if displayStatus === 'saved'}
          <Check size={12} />
        {:else if displayStatus === 'dirty'}
          <Pencil size={12} />
        {:else if displayStatus === 'error'}
          <AlertTriangle size={12} />
        {/if}
        {getStatusText(displayStatus)}
        {#if displayStatus === 'saved' && relativeTime}
          <span class="last-saved">{relativeTime}</span>
        {/if}
      </span>
    {/if}
  </div>
  <div class="status-right">
    {#if noteOpen}
      <div class="process-controls">
        <button
          class="process-btn"
          on:click={handleProcess}
          disabled={processing || !noteOpen || !claude}
          title={claude ? 'Process note (Cmd/Ctrl+Enter)' : 'Install Claude Code for AI features'}
          aria-label="Process note"
        >
          {#if processing}
            <span class="process-spinner"></span>
            Processing...
          {:else}
            Process
          {/if}
        </button>
      </div>
    {/if}
    {#if agentsRunning}
      <span class="agent-status running" title="Background agents organizing your notes">
        <span class="agent-spinner"></span>
        Organizing...
      </span>
    {:else if lastAgentsRun}
      <span class="agent-status idle" title="Last organized: {formatRelativeTime(lastAgentsRun)}">
        <Brain size={11} />
        {formatRelativeTime(lastAgentsRun)}
      </span>
    {/if}
    {#if !claude}
      <span
        class="claude-warning"
        title="Claude Code not installed — AI features unavailable"
        aria-label="Claude Code not installed"
      >
        <AlertTriangle size={12} />
      </span>
    {/if}
    <span
      class="mcp-status"
      class:connected={mcpConnected}
      class:disconnected={!mcpConnected}
      title={mcpConnected ? 'Claude Code integration: connected' : 'Claude Code integration: disconnected'}
      aria-label={mcpConnected ? 'MCP connected' : 'MCP disconnected'}
    ></span>
    <button
      class="theme-toggle"
      on:click={toggleTheme}
      title="Toggle theme"
      aria-label="Toggle light/dark theme"
    >
      {#if theme === 'dark'}
        <Sun size={12} />
      {:else}
        <Moon size={12} />
      {/if}
    </button>
    <span class="status-item">v0.4.1</span>
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

  .save-indicator {
    gap: 4px;
  }

  .save-indicator.saving {
    color: var(--accent-color, #0078d4);
  }

  .save-indicator.saved {
    color: #4caf50;
  }

  .save-indicator.error {
    color: var(--error-color, #f44336);
    cursor: help;
  }

  .save-indicator.dirty {
    color: var(--warning-color, #cca700);
  }

  .last-saved {
    opacity: 0.7;
    margin-left: 4px;
    font-size: 11px;
  }

  .save-indicator :global(.spin-icon) {
    animation: status-spin 0.8s linear infinite;
  }

  .git-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .git-dot.committed {
    background-color: #4caf50;
  }

  .git-dot.uncommitted {
    background-color: #cca700;
  }

  .word-count {
    margin-left: 8px;
    opacity: 0.7;
    font-size: 11px;
  }

  .process-controls {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .process-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 18px;
    font-size: 11px;
    padding: 0 8px;
    background: var(--accent-color, #0078d4);
    color: #fff;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s;
  }

  .process-btn:hover:not(:disabled) {
    background: var(--accent-hover, #1a8ae8);
  }

  .process-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .process-spinner {
    display: inline-block;
    width: 10px;
    height: 10px;
    border: 1.5px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: status-spin 0.8s linear infinite;
  }

  @keyframes status-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .claude-warning {
    display: flex;
    align-items: center;
    color: var(--warning-color, #cca700);
    cursor: help;
  }

  .mcp-status {
    display: inline-block;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .mcp-status.connected {
    background-color: #4caf50;
  }

  .mcp-status.disconnected {
    background-color: #666;
  }

  /* Agent status */
  .agent-status {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
  }

  .agent-status.running {
    color: var(--accent-color, #0078d4);
  }

  .agent-status.idle {
    color: var(--text-muted, #666);
  }

  .agent-spinner {
    display: inline-block;
    width: 10px;
    height: 10px;
    border: 1.5px solid rgba(0, 120, 212, 0.3);
    border-top-color: var(--accent-color, #0078d4);
    border-radius: 50%;
    animation: status-spin 0.8s linear infinite;
  }

  .theme-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 18px;
    background: transparent;
    border: none;
    color: var(--text-muted, #888);
    cursor: pointer;
    border-radius: 3px;
    transition: color 0.15s;
  }

  .theme-toggle:hover {
    color: var(--text-primary, #e0e0e0);
  }
</style>
