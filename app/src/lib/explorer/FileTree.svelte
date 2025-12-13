<script lang="ts">
  import FileNode from './FileNode.svelte';
  import type { FileNode as FileNodeType } from '$lib/stores/workspace';

  export let files: FileNodeType[];
  export let currentFilePath: string | null = null;
  export let onFileClick: (path: string) => void;
</script>

<div class="file-tree">
  {#if files.length === 0}
    <div class="empty">
      <span class="empty-text">No markdown files found</span>
    </div>
  {:else}
    {#each files as node (node.path)}
      <FileNode {node} {currentFilePath} {onFileClick} />
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
