<script lang="ts">
  import { Search } from 'lucide-svelte';
  import { currentWorkspace } from '$lib/stores/workspace';
  import { noteStore, isNoteDirty, saveLastSession } from '$lib/stores/note';
  import { sessionStore } from '$lib/stores/session';
  import { fileStatusStore } from '$lib/stores/fileStatus';
  import { autoSaveStore } from '$lib/stores/autosave';
  import { toast } from '$lib/stores/toast';
  import { getInvoke } from '$lib/utils/tauri';

  interface Props {
    show: boolean;
  }

  let { show = $bindable(false) }: Props = $props();

  let query = $state('');
  let selectedIndex = $state(0);
  let inputRef: HTMLInputElement | undefined = $state();
  let searching = $state(false);
  let debounceTimer: ReturnType<typeof setTimeout> | undefined = $state();

  interface SearchResult {
    filePath: string;
    fileName: string;
    lineNumber: number;
    lineContent: string;
    contextBefore: string;
    contextAfter: string;
  }

  let results: SearchResult[] = $state([]);
  let searchedQuery = $state('');

  let wsPath = '';
  currentWorkspace.subscribe((w) => (wsPath = w?.path ?? ''));

  // Count unique files in results
  let fileCount = $derived(new Set(results.map((r) => r.filePath)).size);

  // Debounced search
  $effect(() => {
    const q = query.trim();
    if (debounceTimer) clearTimeout(debounceTimer);

    if (q.length === 0) {
      results = [];
      searchedQuery = '';
      searching = false;
      return;
    }

    searching = true;
    debounceTimer = setTimeout(async () => {
      await doSearch(q);
    }, 300);
  });

  async function doSearch(q: string) {
    if (!wsPath) {
      searching = false;
      return;
    }
    try {
      const invoke = await getInvoke();
      const res = await invoke<SearchResult[]>('search_notes', {
        workspacePath: wsPath,
        query: q,
      });
      results = res;
      searchedQuery = q;
    } catch (e) {
      console.error('Search failed:', e);
      results = [];
    } finally {
      searching = false;
    }
  }

  // Reset selection when results change
  $effect(() => {
    results;
    selectedIndex = 0;
  });

  // Auto-focus input when shown
  $effect(() => {
    if (show) {
      query = '';
      results = [];
      searchedQuery = '';
      selectedIndex = 0;
      setTimeout(() => inputRef?.focus(), 50);
    }
  });

  function close() {
    show = false;
    query = '';
    results = [];
    searchedQuery = '';
    selectedIndex = 0;
    if (debounceTimer) clearTimeout(debounceTimer);
  }

  async function openResult(result: SearchResult) {
    close();
    try {
      // Save current file if dirty before switching
      let dirty = false;
      isNoteDirty.subscribe((d) => (dirty = d))();
      if (dirty) {
        await autoSaveStore.saveNow();
      }

      await sessionStore.stopTracking();

      // Construct absolute path from workspace + relative path
      const separator = wsPath.includes('\\') ? '\\' : '/';
      const absolutePath = wsPath + separator + result.filePath;

      const invoke = await getInvoke();
      const content = await invoke<string>('read_file', { path: absolutePath });
      noteStore.openNote(absolutePath, content);

      if (wsPath) {
        saveLastSession(wsPath, absolutePath);
      }

      await sessionStore.startTracking(absolutePath);
      await fileStatusStore.refresh();

      // Scroll to line after editor loads
      setTimeout(() => {
        scrollEditorToLine(result.lineNumber);
      }, 150);
    } catch (e) {
      console.error('Failed to open file from search:', e);
      toast.error('Failed to open file');
    }
  }

  function scrollEditorToLine(lineNumber: number) {
    // Find the CodeMirror editor and scroll to the line
    const cmEditor = document.querySelector('.cm-editor');
    if (!cmEditor) return;

    // Access the EditorView instance via CodeMirror's DOM property
    const view = (cmEditor as any).cmView?.view;
    if (!view) return;

    try {
      const line = view.state.doc.line(lineNumber);
      view.dispatch({
        selection: { anchor: line.from },
        scrollIntoView: true,
      });
    } catch {
      // Line number out of range, ignore
    }
  }

  function highlightMatch(text: string, q: string): string {
    if (!q) return escapeHtml(text);
    const escaped = escapeHtml(text);
    const escapedQuery = escapeHtml(q);
    const regex = new RegExp(`(${escapeRegex(escapedQuery)})`, 'gi');
    return escaped.replace(regex, '<mark>$1</mark>');
  }

  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      close();
      e.preventDefault();
    }
    if (e.key === 'ArrowDown') {
      if (results.length > 0) {
        selectedIndex = Math.min(selectedIndex + 1, results.length - 1);
      }
      e.preventDefault();
    }
    if (e.key === 'ArrowUp') {
      if (results.length > 0) {
        selectedIndex = Math.max(selectedIndex - 1, 0);
      }
      e.preventDefault();
    }
    if (e.key === 'Enter' && results.length > 0 && selectedIndex >= 0 && selectedIndex < results.length) {
      openResult(results[selectedIndex]);
      e.preventDefault();
    }
  }

  function scrollSelectedIntoView(index: number) {
    const el = document.querySelector(`.search-result-item[data-index="${index}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }

  $effect(() => {
    scrollSelectedIntoView(selectedIndex);
  });
</script>

{#if show}
  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events, a11y_interactive_supports_focus -->
  <div class="overlay" onclick={close} onkeydown={handleKeydown} role="dialog" aria-label="Search notes" tabindex="-1">
    <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
    <div class="palette" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
      <div class="input-wrapper">
        <Search size={14} />
        <input
          bind:this={inputRef}
          type="text"
          class="search-input"
          placeholder="Search across all notes..."
          bind:value={query}
          onkeydown={handleKeydown}
        />
      </div>
      <div class="result-list">
        {#if searching && results.length === 0}
          <div class="empty">Searching...</div>
        {:else if searchedQuery && results.length === 0}
          <div class="empty">No results found</div>
        {:else if results.length > 0}
          {#each results as result, i}
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div
              class="search-result-item"
              class:selected={i === selectedIndex}
              data-index={i}
              onclick={() => openResult(result)}
              onmouseenter={() => (selectedIndex = i)}
            >
              <div class="result-header">
                <span class="result-file">{result.fileName}</span>
                {#if result.filePath !== result.fileName}
                  <span class="result-path">{result.filePath}</span>
                {/if}
                <span class="result-line">:{result.lineNumber}</span>
              </div>
              {#if result.contextBefore}
                <div class="result-context">{result.contextBefore}</div>
              {/if}
              <div class="result-match">
                {@html highlightMatch(result.lineContent, searchedQuery)}
              </div>
              {#if result.contextAfter}
                <div class="result-context">{result.contextAfter}</div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
      {#if searchedQuery && results.length > 0}
        <div class="footer">
          <span class="count">{results.length} match{results.length !== 1 ? 'es' : ''} in {fileCount} file{fileCount !== 1 ? 's' : ''}</span>
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
    max-width: 700px;
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

  .result-list {
    max-height: 400px;
    overflow-y: auto;
    padding: 4px 0;
  }

  .search-result-item {
    padding: 8px 14px;
    cursor: pointer;
    transition: background 0.05s;
    border-bottom: 1px solid var(--border-color, #333);
  }

  .search-result-item:last-child {
    border-bottom: none;
  }

  .search-result-item:hover,
  .search-result-item.selected {
    background: var(--accent-color, #0078d4);
  }

  .search-result-item.selected .result-file,
  .search-result-item.selected .result-path,
  .search-result-item.selected .result-line,
  .search-result-item.selected .result-match,
  .search-result-item.selected .result-context {
    color: #fff;
  }

  .search-result-item.selected .result-path,
  .search-result-item.selected .result-line,
  .search-result-item.selected .result-context {
    opacity: 0.8;
  }

  .search-result-item.selected :global(mark) {
    background: rgba(255, 255, 255, 0.3);
    color: #fff;
  }

  .result-header {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin-bottom: 4px;
  }

  .result-file {
    font-size: 13px;
    font-weight: 600;
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-primary, #e0e0e0);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .result-path {
    font-size: 11px;
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-muted, #888);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .result-line {
    font-size: 11px;
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-muted, #888);
    flex-shrink: 0;
  }

  .result-match {
    font-size: 12px;
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-primary, #e0e0e0);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.4;
  }

  .result-match :global(mark) {
    background: var(--accent-color, #0078d4);
    color: #fff;
    border-radius: 2px;
    padding: 0 2px;
  }

  .result-context {
    font-size: 11px;
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-muted, #888);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.4;
    opacity: 0.7;
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
