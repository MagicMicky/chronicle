<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
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
  import { noteStore, currentNote, isNoteDirty, saveLastSession, openDailyNote } from '$lib/stores/note';
  import { sessionStore } from '$lib/stores/session';
  import { fileStatusStore, fileStatuses } from '$lib/stores/fileStatus';
  import { autoSaveStore } from '$lib/stores/autosave';
  import { toast } from '$lib/stores/toast';
  import { pickFolder } from '$lib/utils/dialog';
  import { recentFilesStore, recentFiles } from '$lib/stores/recentFiles';
  import FileTree from './FileTree.svelte';
  import ContextMenu from '$lib/components/ContextMenu.svelte';
  import type { MenuItem } from '$lib/components/ContextMenu.svelte';
  import TemplateSelector from '$lib/components/TemplateSelector.svelte';
  import { FolderOpen, Plus, Minus, CalendarDays, ChevronRight, ChevronDown, FileText, Tag, CircleAlert, CircleCheck, Clock, Copy } from 'lucide-svelte';
  import { tagsStore, tagsList, selectedTag, tagFilteredPaths } from '$lib/stores/tags';
  import { actionsStore, actionCounts, actionsByNote } from '$lib/stores/actions';

  let files: FileNode[] = [];
  let currentFilePath: string | null = null;
  let isOpen = false;
  let isLoading = false;
  let workspaceName = '';
  let wsPath = '';
  let recentWs: { path: string; name: string }[] = [];
  let getStatus: (path: string) => 'clean' | 'unsaved' | 'uncommitted' = () => 'clean';
  let isDirty = false;
  let fileCount = 0;

  // Context menu state
  let contextMenuVisible = false;
  let contextMenuX = 0;
  let contextMenuY = 0;
  let contextMenuItems: MenuItem[] = [];

  // Inline rename state
  let renamingPath: string | null = null;

  // Template selector state
  let templateSelectorVisible = false;
  let templateSelectorX = 0;
  let templateSelectorY = 0;
  let newNoteBtn: HTMLButtonElement;

  let recentExpanded = true;
  let tagsExpanded = false;
  let actionsExpanded = false;
  let filesExpanded = true;

  let tags: { tag: string; count: number }[] = [];
  let currentSelectedTag: string | null = null;
  let filteredPaths: Set<string> | null = null;
  let counts = { open: 0, done: 0, stale: 0 };
  let actionsBySource = new Map<string, import('$lib/stores/actions').ActionEntry[]>();

  tagsList.subscribe((t) => (tags = t));
  selectedTag.subscribe((t) => (currentSelectedTag = t));
  tagFilteredPaths.subscribe((p) => (filteredPaths = p));
  actionCounts.subscribe((c) => (counts = c));
  actionsByNote.subscribe((m) => (actionsBySource = m));

  let displayRecent: { path: string; name: string; folder: string }[] = [];

  // Filter files based on selected tag
  function filterFiles(nodes: FileNode[], allowed: Set<string> | null): FileNode[] {
    if (!allowed) return nodes;
    return nodes.reduce<FileNode[]>((acc, node) => {
      if (node.type === 'directory') {
        const filteredChildren = filterFiles(node.children ?? [], allowed);
        if (filteredChildren.length > 0) {
          acc.push({ ...node, children: filteredChildren });
        }
      } else if (allowed.has(node.path) || allowed.has(node.name)) {
        acc.push(node);
      }
      return acc;
    }, []);
  }

  $: displayFiles = filterFiles(files, filteredPaths);

  function handleTagClick(tag: string) {
    tagsStore.selectTag(tag);
  }

  function handleActionSourceClick(source: string) {
    // Source is a relative path like "2026-02-22-standup.md"
    // Find matching file in workspace
    if (wsPath) {
      const fullPath = source.startsWith('/') ? source : `${wsPath}/${source}`;
      handleFileClick(fullPath);
    }
  }

  // Subscribe to stores
  workspaceFiles.subscribe((f) => (files = f));
  currentNote.subscribe((n) => (currentFilePath = n?.path ?? null));
  hasWorkspace.subscribe((h) => (isOpen = h));
  isNoteDirty.subscribe((d) => (isDirty = d));
  workspaceLoading.subscribe((l) => (isLoading = l));
  currentWorkspace.subscribe((w) => {
    workspaceName = w?.name ?? '';
    wsPath = w?.path ?? '';
    fileCount = w?.fileCount ?? 0;
    if (w) {
      fileStatusStore.refresh();
    }
  });
  recentWorkspaces.subscribe((r) => (recentWs = r));
  fileStatuses.subscribe((s) => (getStatus = s.getStatus));
  recentFiles.subscribe((r) => (displayRecent = r));

  onMount(() => {
    workspaceStore.loadRecentWorkspaces();

    // Listen for open-file events from AI panel (related notes)
    function handleOpenFile(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.path) {
        handleFileClick(detail.path);
      }
    }

    // Listen for new-note event from keyboard shortcut (Cmd+N)
    function handleNewNoteEvent() {
      handleNewNote();
    }

    window.addEventListener('chronicle:open-file', handleOpenFile);
    window.addEventListener('chronicle:new-note', handleNewNoteEvent);
    return () => {
      window.removeEventListener('chronicle:open-file', handleOpenFile);
      window.removeEventListener('chronicle:new-note', handleNewNoteEvent);
    };
  });

  function handleCollapse() {
    uiStore.toggleCollapse('explorer');
  }

  async function handleOpenWorkspace() {
    const path = await pickFolder();
    if (path) {
      try {
        await workspaceStore.openWorkspace(path);
        await fileStatusStore.refresh();
      } catch (e) {
        console.error('Failed to open workspace:', e);
      }
    }
  }

  async function handleOpenRecentWorkspace(path: string) {
    try {
      await workspaceStore.openWorkspace(path);
      await fileStatusStore.refresh();
    } catch (e) {
      console.error('Failed to open recent workspace:', e);
    }
  }

  async function handleFileClick(path: string) {
    try {
      if (isDirty) {
        await autoSaveStore.saveNow();
      }

      await sessionStore.stopTracking();

      const invoke = await getInvoke();
      const content = await invoke<string>('read_file', { path });
      noteStore.openNote(path, content);

      // Track in recent files
      recentFilesStore.add(path);

      if (wsPath) {
        saveLastSession(wsPath, path);
      }

      await sessionStore.startTracking(path);
      await fileStatusStore.refresh();
    } catch (e) {
      console.error('Failed to open file:', e);
      toast.error('Failed to open file');
    }
  }

  function handleNewNote() {
    if (newNoteBtn) {
      const rect = newNoteBtn.getBoundingClientRect();
      templateSelectorX = rect.left;
      templateSelectorY = rect.bottom + 4;
    } else {
      templateSelectorX = 60;
      templateSelectorY = 40;
    }
    templateSelectorVisible = true;
  }

  function closeTemplateSelector() {
    templateSelectorVisible = false;
  }

  async function handleTemplateSelect(e: CustomEvent<{ filename: string; path: string; content: string }>) {
    const { path, content } = e.detail;
    templateSelectorVisible = false;

    try {
      if (isDirty) {
        await autoSaveStore.saveNow();
      }
      await sessionStore.stopTracking();

      noteStore.openNote(path, content);
      recentFilesStore.add(path);

      if (wsPath) {
        saveLastSession(wsPath, path);
      }

      await workspaceStore.refreshFiles();
      await sessionStore.startTracking(path);
      await fileStatusStore.refresh();

      // Start rename for the new file
      renamingPath = path;
    } catch (e) {
      console.error('Failed to open template note:', e);
      toast.error('Failed to create note');
    }
  }

  async function handleOpenDailyNote() {
    if (!wsPath) return;
    try {
      if (isDirty) {
        await autoSaveStore.saveNow();
      }
      await sessionStore.stopTracking();
      const filePath = await openDailyNote(wsPath);
      if (filePath) {
        recentFilesStore.add(filePath);
        saveLastSession(wsPath, filePath);
        await sessionStore.startTracking(filePath);
        await fileStatusStore.refresh();
        await workspaceStore.refreshFiles();
      }
    } catch (e) {
      console.error('Failed to open daily note:', e);
      toast.error('Failed to open daily note');
    }
  }

  // --- Context Menu ---

  function closeContextMenu() {
    contextMenuVisible = false;
  }

  function handleNodeContextMenu(e: MouseEvent, node: FileNode) {
    contextMenuX = e.clientX;
    contextMenuY = e.clientY;

    if (node.type === 'directory') {
      contextMenuItems = [
        { label: 'New Note Here...', action: () => handleNewNoteInFolder(node.path) },
        { label: 'New Folder...', action: () => handleNewFolder(node.path) },
        { label: 'Copy Path', action: () => copyPath(node.path), separator: true },
      ];
    } else {
      contextMenuItems = [
        { label: 'Open', action: () => handleFileClick(node.path) },
        { label: 'Rename...', action: () => startRename(node.path) },
        { label: 'Delete', action: () => handleDeleteFile(node.path) },
        { label: 'Copy Path', action: () => copyPath(node.path), separator: true },
      ];
    }

    contextMenuVisible = true;
  }

  function handleEmptyContextMenu(e: MouseEvent) {
    contextMenuX = e.clientX;
    contextMenuY = e.clientY;
    contextMenuItems = [
      { label: 'New Note...', action: () => handleNewNoteInFolder(wsPath) },
      { label: 'New Folder...', action: () => handleNewFolder(wsPath) },
    ];
    contextMenuVisible = true;
  }

  function startRename(path: string) {
    renamingPath = path;
  }

  async function handleRenameSubmit(oldPath: string, newName: string) {
    renamingPath = null;
    if (!newName) return;

    try {
      const invoke = await getInvoke();
      const dir = oldPath.substring(0, oldPath.lastIndexOf('/'));
      const ext = oldPath.endsWith('.md') ? '.md' : '';
      const newPath = `${dir}/${newName}${ext}`;

      const resultPath = await invoke<string>('rename_file', {
        oldPath,
        newPath,
      });

      const note = get(currentNote);
      if (note && note.path === oldPath) {
        noteStore.markSaved(resultPath);
        if (wsPath) {
          saveLastSession(wsPath, resultPath);
        }
      }

      await workspaceStore.refreshFiles();
      await fileStatusStore.refresh();
      toast.success('File renamed');
    } catch (e) {
      console.error('Failed to rename file:', e);
      toast.error('Failed to rename file');
    }
  }

  function handleRenameCancel() {
    renamingPath = null;
  }

  async function handleDeleteFile(path: string) {
    try {
      const { confirm } = await import('@tauri-apps/plugin-dialog');
      const fileName = path.substring(path.lastIndexOf('/') + 1);
      const confirmed = await confirm(
        `Are you sure you want to delete "${fileName}"? It will be moved to the trash.`,
        { title: 'Delete File', kind: 'warning' }
      );
      if (!confirmed) return;

      const invoke = await getInvoke();
      await invoke('delete_file', { path });

      const note = get(currentNote);
      if (note && note.path === path) {
        await sessionStore.stopTracking();
        noteStore.closeNote();
      }

      await workspaceStore.refreshFiles();
      await fileStatusStore.refresh();
      toast.success('File moved to trash');
    } catch (e) {
      console.error('Failed to delete file:', e);
      toast.error('Failed to delete file');
    }
  }

  async function handleNewNoteInFolder(folderPath: string) {
    try {
      if (isDirty) {
        await autoSaveStore.saveNow();
      }
      await sessionStore.stopTracking();

      const invoke = await getInvoke();
      const content = '# New Note\n\n';
      const notePath = await invoke<string>('generate_note_path', {
        workspacePath: folderPath,
        content,
      });

      await invoke('write_file', { path: notePath, content });
      noteStore.openNote(notePath, content);

      if (wsPath) {
        saveLastSession(wsPath, notePath);
      }

      await workspaceStore.refreshFiles();
      await sessionStore.startTracking(notePath);
      await fileStatusStore.refresh();

      renamingPath = notePath;
    } catch (e) {
      console.error('Failed to create note:', e);
      toast.error('Failed to create note');
    }
  }

  async function handleNewFolder(parentPath: string) {
    try {
      const folderName = prompt('Folder name:');
      if (!folderName) return;

      const invoke = await getInvoke();
      const folderPath = `${parentPath}/${folderName}`;
      await invoke('create_folder', {
        workspacePath: wsPath,
        folderPath,
      });

      await workspaceStore.refreshFiles();
      toast.success('Folder created');
    } catch (e) {
      console.error('Failed to create folder:', e);
      toast.error('Failed to create folder');
    }
  }

  async function copyPath(path: string) {
    try {
      const relative = wsPath ? path.replace(wsPath + '/', '') : path;
      await navigator.clipboard.writeText(relative);
      toast.success('Path copied');
    } catch (e) {
      console.error('Failed to copy path:', e);
      toast.error('Failed to copy path');
    }
  }

  async function copyActions(e: Event) {
    e.stopPropagation();
    const lines: string[] = [];
    for (const [source, items] of actionsBySource.entries()) {
      for (const item of items) {
        const suffix = source ? ` (from: ${source})` : '';
        lines.push(`- [ ] ${item.text}${suffix}`);
      }
    }
    if (lines.length === 0) {
      toast.info('No open actions to copy');
      return;
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast.success('Actions copied!', 2000);
    } catch {
      toast.error('Failed to copy actions');
    }
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
          bind:this={newNoteBtn}
          on:click={handleNewNote}
          title="New Note (Cmd+N)"
          aria-label="New Note"
        >
          <Plus size={14} />
        </button>
        <button
          class="action-btn today-btn"
          on:click={handleOpenDailyNote}
          title="Today's Note (Cmd+T)"
          aria-label="Today's Note"
        >
          <CalendarDays size={14} />
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
      <!-- Recent Files Section -->
      {#if displayRecent.length > 0}
        <div class="section">
          <button class="section-header" on:click={() => (recentExpanded = !recentExpanded)}>
            <span class="section-chevron">
              {#if recentExpanded}
                <ChevronDown size={12} />
              {:else}
                <ChevronRight size={12} />
              {/if}
            </span>
            <span class="section-title">Recent</span>
          </button>
          {#if recentExpanded}
            <div class="recent-files">
              {#each displayRecent as file (file.path)}
                <button
                  class="recent-file-item"
                  class:selected={file.path === currentFilePath}
                  on:click={() => handleFileClick(file.path)}
                  title={file.path}
                >
                  <span class="recent-file-icon"><FileText size={13} /></span>
                  <span class="recent-file-name">{file.name}</span>
                  {#if file.folder}
                    <span class="recent-file-folder">{file.folder}</span>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Tags Section -->
      <div class="section">
        <button class="section-header" on:click={() => (tagsExpanded = !tagsExpanded)}>
          <span class="section-chevron">
            {#if tagsExpanded}
              <ChevronDown size={12} />
            {:else}
              <ChevronRight size={12} />
            {/if}
          </span>
          <span class="section-title">Tags</span>
          {#if tags.length > 0}
            <span class="section-count">({tags.length})</span>
          {/if}
        </button>
        {#if tagsExpanded}
          <div class="tags-content">
            {#if tags.length > 0}
              <div class="tags-list">
                {#each tags as { tag, count } (tag)}
                  <button
                    class="tag-pill"
                    class:active={currentSelectedTag === tag}
                    on:click={() => handleTagClick(tag)}
                    title="{count} note{count !== 1 ? 's' : ''}"
                  >
                    <span class="tag-name">#{tag}</span>
                    <span class="tag-count">{count}</span>
                  </button>
                {/each}
              </div>
            {:else}
              <div class="section-empty">
                <span class="empty-text">No tags yet</span>
                <span class="empty-hint">Tags appear after AI organizes your notes</span>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Actions Section -->
      <div class="section">
        <button class="section-header" on:click={() => (actionsExpanded = !actionsExpanded)}>
          <span class="section-chevron">
            {#if actionsExpanded}
              <ChevronDown size={12} />
            {:else}
              <ChevronRight size={12} />
            {/if}
          </span>
          <span class="section-title">Actions</span>
          {#if counts.open + counts.stale > 0}
            <span class="section-count actions-count">
              {counts.open + counts.stale}
              {#if counts.stale > 0}
                <span class="stale-badge">{counts.stale}</span>
              {/if}
            </span>
            <span
              class="section-copy-btn"
              role="button"
              tabindex="0"
              on:click={copyActions}
              on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copyActions(e); } }}
              title="Copy all open actions"
              aria-label="Copy Actions"
            >
              <Copy size={11} />
            </span>
          {/if}
        </button>
        {#if actionsExpanded}
          <div class="actions-content">
            {#if actionsBySource.size > 0}
              {#each [...actionsBySource.entries()] as [source, items] (source)}
                <div class="action-group">
                  <button
                    class="action-source"
                    on:click={() => handleActionSourceClick(source)}
                    title="Open {source}"
                  >
                    <FileText size={12} />
                    <span class="action-source-name">{source}</span>
                  </button>
                  {#each items as item}
                    <button
                      class="action-item"
                      class:stale={item.status === 'stale'}
                      on:click={() => handleActionSourceClick(item.source)}
                      title="{item.status === 'stale' ? 'Overdue: ' : ''}{item.text}"
                    >
                      {#if item.status === 'stale'}
                        <CircleAlert size={12} />
                      {:else}
                        <CircleCheck size={12} />
                      {/if}
                      <span class="action-text">{item.text}</span>
                      {#if item.owner}
                        <span class="action-owner">@{item.owner}</span>
                      {/if}
                    </button>
                  {/each}
                </div>
              {/each}
            {:else}
              <div class="section-empty">
                <span class="empty-text">No open actions</span>
                <span class="empty-hint">Actions are tracked from your notes</span>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Files Section -->
      <div class="section section-files">
        <button class="section-header" on:click={() => (filesExpanded = !filesExpanded)}>
          <span class="section-chevron">
            {#if filesExpanded}
              <ChevronDown size={12} />
            {:else}
              <ChevronRight size={12} />
            {/if}
          </span>
          <span class="section-title">Files</span>
          <span class="section-count">({fileCount})</span>
          {#if currentSelectedTag}
            <span class="filter-indicator" title="Filtered by #{currentSelectedTag}">
              <Tag size={10} />
            </span>
          {/if}
        </button>
        {#if filesExpanded}
          <FileTree
            files={displayFiles}
            {currentFilePath}
            onFileClick={handleFileClick}
            onContextMenu={handleNodeContextMenu}
            onEmptyContextMenu={handleEmptyContextMenu}
            {getStatus}
            {renamingPath}
            onRenameSubmit={handleRenameSubmit}
            onRenameCancel={handleRenameCancel}
          />
        {/if}
      </div>
    {:else}
      <!-- No workspace open -->
      <div class="placeholder">
        <span class="placeholder-icon"><FolderOpen size={32} /></span>
        <span class="placeholder-text">File Explorer</span>
        <span class="placeholder-hint">Open a workspace to see files</span>
        <button class="open-btn" on:click={handleOpenWorkspace}>
          Open Workspace
        </button>
        {#if recentWs.length > 0}
          <div class="recent-ws-section">
            <span class="recent-ws-label">Recent</span>
            <div class="recent-ws-list">
              {#each recentWs.slice(0, 5) as workspace}
                <button
                  class="recent-ws-item"
                  on:click={() => handleOpenRecentWorkspace(workspace.path)}
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

<ContextMenu
  items={contextMenuItems}
  x={contextMenuX}
  y={contextMenuY}
  visible={contextMenuVisible}
  onClose={closeContextMenu}
/>

<TemplateSelector
  visible={templateSelectorVisible}
  anchorX={templateSelectorX}
  anchorY={templateSelectorY}
  on:select={handleTemplateSelect}
  on:close={closeTemplateSelector}
/>

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

  .today-btn {
    color: var(--accent-color, #0078d4);
  }

  .pane-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: auto;
  }

  /* Section layout */
  .section {
    display: flex;
    flex-direction: column;
  }

  .section-files {
    flex: 1;
    min-height: 0;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    border: none;
    background: var(--header-bg, #252525);
    border-bottom: 1px solid var(--border-color, #333);
    cursor: pointer;
    width: 100%;
    text-align: left;
  }

  .section-header:hover {
    background: var(--hover-bg, #333);
  }

  .section-chevron {
    display: flex;
    align-items: center;
    color: var(--text-muted, #888);
  }

  .section-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted, #888);
  }

  .section-count {
    font-size: 11px;
    color: var(--text-muted, #666);
    margin-left: 2px;
  }

  .section-copy-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    margin-left: auto;
    background: transparent;
    border: none;
    color: var(--text-muted, #666);
    cursor: pointer;
    border-radius: 3px;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .section-header:hover .section-copy-btn {
    opacity: 1;
  }

  .section-copy-btn:hover {
    background: var(--hover-bg, #333);
    color: var(--text-primary, #fff);
  }

  /* Recent files items */
  .recent-files {
    display: flex;
    flex-direction: column;
    padding: 2px 0;
  }

  .recent-file-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px 4px 24px;
    border: none;
    background: transparent;
    color: var(--text-secondary, #ccc);
    font-size: 13px;
    text-align: left;
    cursor: pointer;
    border-radius: 3px;
    width: 100%;
  }

  .recent-file-item:hover {
    background: var(--hover-bg, #333);
  }

  .recent-file-item.selected {
    background: var(--accent-color, #0078d4);
    color: white;
  }

  .recent-file-icon {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .recent-file-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .recent-file-folder {
    font-size: 11px;
    color: var(--text-muted, #666);
    flex-shrink: 0;
  }

  .recent-file-item.selected .recent-file-folder {
    color: rgba(255, 255, 255, 0.7);
  }

  /* No-workspace placeholder */
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

  .recent-ws-section {
    margin-top: 20px;
    width: 100%;
    max-width: 200px;
  }

  .recent-ws-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted, #666);
    display: block;
    margin-bottom: 8px;
  }

  .recent-ws-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .recent-ws-item {
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

  .recent-ws-item:hover {
    background: var(--border-color, #333);
  }

  /* Tags section */
  .tags-content {
    padding: 6px 12px;
  }

  .tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .tag-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    font-size: 11px;
    background: var(--hover-bg, #2a2a2a);
    border: 1px solid var(--border-color, #333);
    border-radius: 12px;
    color: var(--text-secondary, #ccc);
    cursor: pointer;
    transition: all 0.15s;
  }

  .tag-pill:hover {
    background: var(--border-color, #333);
    border-color: var(--text-muted, #888);
  }

  .tag-pill.active {
    background: var(--accent-color, #0078d4);
    border-color: var(--accent-color, #0078d4);
    color: #fff;
  }

  .tag-name {
    white-space: nowrap;
  }

  .tag-count {
    font-size: 10px;
    opacity: 0.7;
  }

  .tag-pill.active .tag-count {
    opacity: 0.9;
  }

  /* Actions section */
  .actions-content {
    padding: 2px 0;
  }

  .actions-count {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .stale-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    min-width: 14px;
    height: 14px;
    padding: 0 3px;
    background: var(--warning-color, #cca700);
    color: #000;
    border-radius: 7px;
    font-weight: 600;
  }

  .action-group {
    margin-bottom: 2px;
  }

  .action-source {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    width: 100%;
    border: none;
    background: transparent;
    color: var(--text-muted, #888);
    font-size: 11px;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
    text-transform: none;
  }

  .action-source:hover {
    background: var(--hover-bg, #333);
    color: var(--text-secondary, #ccc);
  }

  .action-source-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .action-item {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 3px 12px 3px 28px;
    width: 100%;
    border: none;
    background: transparent;
    color: var(--text-secondary, #ccc);
    font-size: 12px;
    text-align: left;
    cursor: pointer;
    line-height: 1.3;
  }

  .action-item:hover {
    background: var(--hover-bg, #333);
  }

  .action-item.stale {
    color: var(--warning-color, #cca700);
  }

  .action-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .action-owner {
    font-size: 10px;
    color: var(--text-muted, #666);
    flex-shrink: 0;
  }

  .filter-indicator {
    display: inline-flex;
    align-items: center;
    color: var(--accent-color, #0078d4);
    margin-left: 4px;
  }

  /* Shared empty state for sections */
  .section-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 12px;
    gap: 4px;
  }

  .empty-text {
    font-size: 12px;
    color: var(--text-muted, #888);
  }

  .empty-hint {
    font-size: 11px;
    color: var(--text-muted, #666);
    opacity: 0.7;
    text-align: center;
  }
</style>
