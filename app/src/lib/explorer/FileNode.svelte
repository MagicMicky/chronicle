<script lang="ts">
  import type { FileNode } from '$lib/stores/workspace';
  import type { FileStatus } from '$lib/stores/fileStatus';
  import { ChevronRight, ChevronDown, FileText } from 'lucide-svelte';

  export let node: FileNode;
  export let depth: number = 0;
  export let currentFilePath: string | null = null;
  export let onFileClick: (path: string) => void;
  export let onContextMenu: (e: MouseEvent, node: FileNode) => void = () => {};
  export let getStatus: (path: string) => FileStatus = () => 'clean';
  export let renamingPath: string | null = null;
  export let onRenameSubmit: (oldPath: string, newName: string) => void = () => {};
  export let onRenameCancel: () => void = () => {};

  let expanded = depth === 0;
  let renameInput: HTMLInputElement;
  let renameValue = '';

  $: isSelected = node.path === currentFilePath;
  $: isDirectory = node.type === 'directory';
  $: indent = depth * 16;
  $: status = isDirectory ? 'clean' : getStatus(node.path);
  $: isRenaming = renamingPath === node.path;

  $: if (isRenaming && renameInput) {
    // Strip .md extension for editing
    const name = node.name;
    renameValue = name.endsWith('.md') ? name.slice(0, -3) : name;
    renameInput.value = renameValue;
    renameInput.select();
  }

  function handleClick() {
    if (isRenaming) return;
    if (isDirectory) {
      expanded = !expanded;
    } else {
      onFileClick(node.path);
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, node);
  }

  function handleRenameKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const input = e.target as HTMLInputElement;
      onRenameSubmit(node.path, input.value.trim());
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onRenameCancel();
    }
  }

  function handleRenameBlur() {
    onRenameCancel();
  }
</script>

<div class="file-node">
  <button
    class="node-row"
    class:selected={isSelected}
    class:directory={isDirectory}
    style="padding-left: {indent + 8}px"
    on:click={handleClick}
    on:keydown={handleKeydown}
    on:contextmenu={handleContextMenu}
    title={node.path}
  >
    <span class="icon">
      {#if isDirectory}
        <span class="chevron" class:expanded>
          {#if expanded}
            <ChevronDown size={14} />
          {:else}
            <ChevronRight size={14} />
          {/if}
        </span>
      {:else}
        <span class="file-icon"><FileText size={14} /></span>
      {/if}
    </span>
    {#if isRenaming}
      <input
        class="rename-input"
        bind:this={renameInput}
        on:keydown={handleRenameKeydown}
        on:blur={handleRenameBlur}
        on:click|stopPropagation
      />
    {:else}
      <span class="name">{node.name}</span>
    {/if}
    {#if status !== 'clean'}
      <span
        class="status-dot"
        class:unsaved={status === 'unsaved'}
        class:uncommitted={status === 'uncommitted'}
        title={status === 'unsaved' ? 'Unsaved changes' : 'Uncommitted changes'}
      ></span>
    {/if}
  </button>

  {#if isDirectory && expanded && node.children}
    <div class="children">
      {#each node.children as child (child.path)}
        <svelte:self
          node={child}
          depth={depth + 1}
          {currentFilePath}
          {onFileClick}
          {onContextMenu}
          {getStatus}
          {renamingPath}
          {onRenameSubmit}
          {onRenameCancel}
        />
      {/each}
    </div>
  {/if}
</div>

<style>
  .file-node {
    user-select: none;
  }

  .node-row {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 4px 8px;
    border: none;
    background: transparent;
    color: var(--text-secondary, #ccc);
    font-size: 13px;
    text-align: left;
    cursor: pointer;
    border-radius: 3px;
    transition: background 0.1s;
  }

  .node-row:hover {
    background: var(--hover-bg, #333);
  }

  .node-row.selected {
    background: var(--accent-color, #0078d4);
    color: white;
  }

  .node-row.directory {
    font-weight: 500;
  }

  .icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    flex-shrink: 0;
  }

  .chevron {
    font-size: 10px;
    color: var(--text-muted, #888);
    transition: transform 0.15s;
  }

  .chevron.expanded {
    color: var(--text-secondary, #ccc);
  }

  .file-icon {
    font-size: 12px;
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .rename-input {
    flex: 1;
    min-width: 0;
    padding: 1px 4px;
    font-size: 13px;
    font-family: inherit;
    background: var(--pane-bg, #1e1e1e);
    color: var(--text-primary, #fff);
    border: 1px solid var(--accent-color, #0078d4);
    border-radius: 3px;
    outline: none;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-left: auto;
  }

  .status-dot.unsaved {
    background-color: var(--warning-color, #cca700);
  }

  .status-dot.uncommitted {
    background-color: var(--info-color, #e89e4c);
  }

  .node-row.selected .status-dot.unsaved {
    background-color: #ffd700;
  }

  .node-row.selected .status-dot.uncommitted {
    background-color: #ffb366;
  }

  .children {
    margin-left: 0;
  }
</style>
