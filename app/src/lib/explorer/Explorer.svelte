<script lang="ts">
  import { onMount } from 'svelte';
  import { getInvoke } from '$lib/utils/tauri';
  import { uiStore } from '$lib/stores/ui';
  import {
    workspaceStore,
    workspaceFiles,
    hasWorkspace,
    currentWorkspace,
    workspaceLoading,
    recentWorkspaces,
    type FileNode,
  } from '$lib/stores/workspace';
  import { noteStore, currentNote, isNoteDirty, saveLastSession } from '$lib/stores/note';
  import { sessionStore } from '$lib/stores/session';
  import { fileStatusStore, fileStatuses } from '$lib/stores/fileStatus';
  import { autoSaveStore } from '$lib/stores/autosave';
  import { toast } from '$lib/stores/toast';
  import { pickFolder } from '$lib/utils/dialog';
  import FileTree from './FileTree.svelte';
  import { FolderOpen, X, Minus } from 'lucide-svelte';

  let files: FileNode[] = [];
  let currentFilePath: string | null = null;
  let isOpen = false;
  let isLoading = false;
  let workspaceName = '';
  let wsPath = '';
  let recent: { path: string; name: string }[] = [];
  let getStatus: (path: string) => 'clean' | 'unsaved' | 'uncommitted' = () => 'clean';
  let isDirty = false;

  // Subscribe to stores
  workspaceFiles.subscribe((f) => (files = f));
  currentNote.subscribe((n) => (currentFilePath = n?.path ?? null));
  hasWorkspace.subscribe((h) => (isOpen = h));
  isNoteDirty.subscribe((d) => (isDirty = d));
  workspaceLoading.subscribe((l) => (isLoading = l));
  currentWorkspace.subscribe((w) => {
    workspaceName = w?.name ?? '';
    wsPath = w?.path ?? '';
    // Refresh git status when workspace changes
    if (w) {
      fileStatusStore.refresh();
    }
  });
  recentWorkspaces.subscribe((r) => (recent = r));
  fileStatuses.subscribe((s) => (getStatus = s.getStatus));

  onMount(() => {
    workspaceStore.loadRecentWorkspaces();
  });

  function handleCollapse() {
    uiStore.toggleCollapse('explorer');
  }

  async function handleOpenWorkspace() {
    const path = await pickFolder();
    if (path) {
      try {
        await workspaceStore.openWorkspace(path);
        // Refresh git status after opening workspace
        await fileStatusStore.refresh();
      } catch (e) {
        console.error('Failed to open workspace:', e);
      }
    }
  }

  async function handleOpenRecent(path: string) {
    try {
      await workspaceStore.openWorkspace(path);
      // Refresh git status after opening workspace
      await fileStatusStore.refresh();
    } catch (e) {
      console.error('Failed to open recent workspace:', e);
    }
  }

  async function handleFileClick(path: string) {
    try {
      // Save current file if dirty before switching
      if (isDirty) {
        await autoSaveStore.saveNow();
      }

      // Stop tracking current note's session (this commits)
      await sessionStore.stopTracking();

      const invoke = await getInvoke();
      const content = await invoke<string>('read_file', { path });
      noteStore.openNote(path, content);

      // Persist last session for state restoration
      if (wsPath) {
        saveLastSession(wsPath, path);
      }

      // Start tracking session for this file
      await sessionStore.startTracking(path);

      // Refresh git status after file switch (commit may have happened)
      await fileStatusStore.refresh();
    } catch (e) {
      console.error('Failed to open file:', e);
      toast.error('Failed to open file');
    }
  }

  async function handleCloseWorkspace() {
    // Save current file if dirty before closing
    if (isDirty) {
      await autoSaveStore.saveNow();
    }

    // Stop session tracking before closing
    await sessionStore.stopTracking();
    workspaceStore.closeWorkspace();
    noteStore.closeNote();
    sessionStore.reset();
    fileStatusStore.reset();
  }
</script>

<div class="explorer">
  <div class="pane-header">
    <span class="pane-title">
      {#if isOpen}
        {workspaceName}
      {:else}
        Explorer
      {/if}
    </span>
    <div class="header-actions">
      {#if isOpen}
        <button
          class="action-btn"
          on:click={handleCloseWorkspace}
          title="Close Workspace"
          aria-label="Close Workspace"
        >
          <X size={14} />
        </button>
      {/if}
      <button class="collapse-btn" on:click={handleCollapse} title="Collapse Explorer" aria-label="Collapse Explorer">
        <Minus size={14} />
      </button>
    </div>
  </div>
  <div class="pane-content">
    {#if isLoading}
      <div class="placeholder">
        <span class="placeholder-text">Loading...</span>
      </div>
    {:else if isOpen}
      <FileTree {files} {currentFilePath} onFileClick={handleFileClick} {getStatus} />
    {:else}
      <div class="placeholder">
        <span class="placeholder-icon"><FolderOpen size={32} /></span>
        <span class="placeholder-text">File Explorer</span>
        <span class="placeholder-hint">Open a workspace to see files</span>
        <button class="open-btn" on:click={handleOpenWorkspace}>
          Open Workspace
        </button>
        {#if recent.length > 0}
          <div class="recent-section">
            <span class="recent-label">Recent</span>
            <div class="recent-list">
              {#each recent.slice(0, 5) as workspace}
                <button
                  class="recent-item"
                  on:click={() => handleOpenRecent(workspace.path)}
                  title={workspace.path}
                >
                  {workspace.name}
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .explorer {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--pane-bg, #1e1e1e);
  }

  .pane-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--header-bg, #252525);
    border-bottom: 1px solid var(--border-color, #333);
  }

  .pane-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted, #888);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 150px;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .collapse-btn,
  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    background: transparent;
    border: none;
    color: var(--text-muted, #888);
    cursor: pointer;
    border-radius: 3px;
  }

  .collapse-btn:hover,
  .action-btn:hover {
    background: var(--hover-bg, #333);
    color: var(--text-primary, #fff);
  }

  .pane-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: auto;
  }

  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: var(--text-muted, #666);
    height: 100%;
    padding: 16px;
  }

  .placeholder-icon {
    font-size: 32px;
    opacity: 0.5;
  }

  .placeholder-text {
    font-size: 14px;
    font-weight: 500;
  }

  .placeholder-hint {
    font-size: 12px;
    opacity: 0.7;
  }

  .open-btn {
    margin-top: 12px;
    padding: 8px 16px;
    font-size: 13px;
    border-radius: 4px;
    background: var(--accent-color, #0078d4);
    color: white;
    border: none;
    cursor: pointer;
    transition: background 0.15s;
  }

  .open-btn:hover {
    background: var(--accent-hover, #1a86dc);
  }

  .recent-section {
    margin-top: 20px;
    width: 100%;
    max-width: 200px;
  }

  .recent-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted, #666);
    display: block;
    margin-bottom: 8px;
  }

  .recent-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .recent-item {
    padding: 6px 10px;
    font-size: 12px;
    text-align: left;
    background: var(--hover-bg, #2a2a2a);
    border: none;
    border-radius: 4px;
    color: var(--text-secondary, #ccc);
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: background 0.1s;
  }

  .recent-item:hover {
    background: var(--border-color, #333);
  }
</style>
