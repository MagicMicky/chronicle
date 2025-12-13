<script lang="ts">
  import type { FileNode } from '$lib/stores/workspace';
  import type { FileStatus } from '$lib/stores/fileStatus';

  export let node: FileNode;
  export let depth: number = 0;
  export let currentFilePath: string | null = null;
  export let onFileClick: (path: string) => void;
  export let getStatus: (path: string) => FileStatus = () => 'clean';

  let expanded = depth === 0; // Expand root level by default

  $: isSelected = node.path === currentFilePath;
  $: isDirectory = node.type === 'directory';
  $: indent = depth * 16;
  $: status = isDirectory ? 'clean' : getStatus(node.path);

  function handleClick() {
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
</script>

<div class="file-node">
  <button
    class="node-row"
    class:selected={isSelected}
    class:directory={isDirectory}
    style="padding-left: {indent + 8}px"
    on:click={handleClick}
    on:keydown={handleKeydown}
    title={node.path}
  >
    <span class="icon">
      {#if isDirectory}
        <span class="chevron" class:expanded>{expanded ? '\u25BC' : '\u25B6'}</span>
      {:else}
        <span class="file-icon">&#128196;</span>
      {/if}
    </span>
    <span class="name">{node.name}</span>
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
          {getStatus}
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

  /* When selected, make dots more visible */
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
