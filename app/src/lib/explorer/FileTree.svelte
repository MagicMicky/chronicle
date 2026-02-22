<script lang="ts">
  import FileNode from './FileNode.svelte';
  import type { FileNode as FileNodeType } from '$lib/stores/workspace';
  import type { FileStatus } from '$lib/stores/fileStatus';

  export let files: FileNodeType[];
  export let currentFilePath: string | null = null;
  export let onFileClick: (path: string) => void;
  export let onContextMenu: (e: MouseEvent, node: FileNodeType) => void = () => {};
  export let onEmptyContextMenu: (e: MouseEvent) => void = () => {};
  export let getStatus: (path: string) => FileStatus = () => 'clean';
  export let renamingPath: string | null = null;
  export let onRenameSubmit: (oldPath: string, newName: string) => void = () => {};
  export let onRenameCancel: () => void = () => {};

  function handleEmptyContextMenu(e: MouseEvent) {
    // Only fire if right-clicking on the tree background, not on a node
    if (e.target === e.currentTarget) {
      e.preventDefault();
      onEmptyContextMenu(e);
    }
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="file-tree" on:contextmenu={handleEmptyContextMenu}>
  {#if files.length === 0}
    <div class="empty">
      <span class="empty-text">No markdown files found</span>
    </div>
  {:else}
    {#each files as node (node.path)}
      <FileNode
        {node}
        {currentFilePath}
        {onFileClick}
        {onContextMenu}
        {getStatus}
        {renamingPath}
        {onRenameSubmit}
        {onRenameCancel}
      />
    {/each}
  {/if}
</div>

<style>
  .file-tree {
    padding: 4px 0;
    overflow-y: auto;
    overflow-x: hidden;
    height: 100%;
  }

  .empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 16px;
  }

  .empty-text {
    color: var(--text-muted, #666);
    font-size: 12px;
    text-align: center;
  }
</style>
