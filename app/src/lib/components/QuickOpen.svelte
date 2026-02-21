<script lang="ts">
  import { Search } from 'lucide-svelte';
  import { workspaceFiles, currentWorkspace, type FileNode } from '$lib/stores/workspace';
  import { noteStore, isNoteDirty } from '$lib/stores/note';
  import { sessionStore } from '$lib/stores/session';
  import { fileStatusStore } from '$lib/stores/fileStatus';
  import { autoSaveStore } from '$lib/stores/autosave';
  import { getInvoke } from '$lib/utils/tauri';

  interface Props {
    show: boolean;
  }

  let { show = $bindable(false) }: Props = $props();

  let query = $state('');
  let selectedIndex = $state(0);
  let inputRef: HTMLInputElement | undefined = $state();

  // Flatten the file tree to get all markdown files
  function flattenFiles(nodes: FileNode[], workspacePath: string): { name: string; path: string; relative: string }[] {
    const result: { name: string; path: string; relative: string }[] = [];
    function walk(items: FileNode[]) {
      for (const item of items) {
        if (item.type === 'file' && item.name.endsWith('.md')) {
          // Compute relative path from workspace root
          let relative = item.path;
          if (workspacePath && item.path.startsWith(workspacePath)) {
            relative = item.path.slice(workspacePath.length);
            if (relative.startsWith('/') || relative.startsWith('\\')) {
              relative = relative.slice(1);
            }
          }
          result.push({ name: item.name, path: item.path, relative });
        }
        if (item.children) {
          walk(item.children);
        }
      }
    }
    walk(nodes);
    return result.sort((a, b) => a.relative.localeCompare(b.relative));
  }

  let files: FileNode[] = [];
  let wsPath = '';
  workspaceFiles.subscribe((f) => (files = f));
  currentWorkspace.subscribe((w) => (wsPath = w?.path ?? ''));

  let allFiles = $derived(flattenFiles(files, wsPath));

  let filteredFiles = $derived(
    query.trim() === ''
      ? allFiles
      : allFiles.filter((f) => f.relative.toLowerCase().includes(query.toLowerCase()))
  );

  // Reset selection when query changes
  $effect(() => {
    query;
    selectedIndex = 0;
  });

  // Auto-focus input when shown
  $effect(() => {
    if (show) {
      setTimeout(() => inputRef?.focus(), 50);
    }
  });

  function close() {
    show = false;
    query = '';
    selectedIndex = 0;
  }

  async function selectFile(file: { name: string; path: string; relative: string }) {
    close();
    try {
      // Save current file if dirty before switching
      let dirty = false;
      isNoteDirty.subscribe((d) => (dirty = d))();
      if (dirty) {
        await autoSaveStore.saveNow();
      }

      // Stop tracking current note's session
      await sessionStore.stopTracking();

      const invoke = await getInvoke();
      const content = await invoke<string>('read_file', { path: file.path });
      noteStore.openNote(file.path, content);

      // Start tracking session for this file
      await sessionStore.startTracking(file.path);

      // Refresh git status after file switch
      await fileStatusStore.refresh();
    } catch (e) {
      console.error('Failed to open file:', e);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      close();
      e.preventDefault();
    }
    if (e.key === 'ArrowDown') {
      selectedIndex = Math.min(selectedIndex + 1, filteredFiles.length - 1);
      e.preventDefault();
    }
    if (e.key === 'ArrowUp') {
      selectedIndex = Math.max(selectedIndex - 1, 0);
      e.preventDefault();
    }
    if (e.key === 'Enter' && filteredFiles.length > 0) {
      selectFile(filteredFiles[selectedIndex]);
      e.preventDefault();
    }
  }

  function scrollSelectedIntoView(index: number) {
    const el = document.querySelector(`.quick-open-item[data-index="${index}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }

  $effect(() => {
    scrollSelectedIntoView(selectedIndex);
  });
</script>

{#if show}
  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events, a11y_interactive_supports_focus -->
  <div class="overlay" onclick={close} onkeydown={handleKeydown} role="dialog" aria-label="Quick file open" tabindex="-1">
    <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
    <div class="palette" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
      <div class="input-wrapper">
        <Search size={14} />
        <input
          bind:this={inputRef}
          type="text"
          class="search-input"
          placeholder="Search files..."
          bind:value={query}
          onkeydown={handleKeydown}
        />
      </div>
      <div class="file-list">
        {#if filteredFiles.length === 0}
          <div class="empty">No matching files</div>
        {:else}
          {#each filteredFiles.slice(0, 50) as file, i}
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div
              class="quick-open-item"
              class:selected={i === selectedIndex}
              data-index={i}
              onclick={() => selectFile(file)}
              onmouseenter={() => (selectedIndex = i)}
            >
              <span class="file-name">{file.name}</span>
              {#if file.relative !== file.name}
                <span class="file-path">{file.relative}</span>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
      {#if allFiles.length > 0}
        <div class="footer">
          <span class="count">{filteredFiles.length} of {allFiles.length} files</span>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 15vh;
    z-index: 1000;
  }

  .palette {
    background: var(--bg-secondary, #252525);
    border: 1px solid var(--border-color, #333);
    border-radius: 8px;
    width: 90%;
    max-width: 500px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    overflow: hidden;
  }

  .input-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border-color, #333);
    color: var(--text-muted, #888);
  }

  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    font-size: 14px;
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-primary, #e0e0e0);
  }

  .search-input::placeholder {
    color: var(--text-muted, #888);
    opacity: 0.6;
  }

  .file-list {
    max-height: 320px;
    overflow-y: auto;
    padding: 4px 0;
  }

  .quick-open-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    cursor: pointer;
    transition: background 0.05s;
  }

  .quick-open-item:hover,
  .quick-open-item.selected {
    background: var(--accent-color, #0078d4);
  }

  .quick-open-item.selected .file-name,
  .quick-open-item.selected .file-path {
    color: #fff;
  }

  .file-name {
    font-size: 13px;
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-primary, #e0e0e0);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 0;
  }

  .file-path {
    font-size: 11px;
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-muted, #888);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .empty {
    padding: 16px 14px;
    font-size: 13px;
    color: var(--text-muted, #888);
    text-align: center;
  }

  .footer {
    padding: 6px 14px;
    border-top: 1px solid var(--border-color, #333);
  }

  .count {
    font-size: 11px;
    color: var(--text-muted, #888);
  }
</style>
