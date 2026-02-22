<script lang="ts">
  import { onMount } from 'svelte';
  import { archiveStore, filteredArchive, allTags, type ProcessedNoteInfo } from '$lib/stores/archive';
  import { currentWorkspace } from '$lib/stores/workspace';
  import { noteStore, isNoteDirty } from '$lib/stores/note';
  import { sessionStore } from '$lib/stores/session';
  import { fileStatusStore } from '$lib/stores/fileStatus';
  import { autoSaveStore } from '$lib/stores/autosave';
  import { getInvoke } from '$lib/utils/tauri';

  interface Props {
    show: boolean;
  }

  let { show = $bindable(false) }: Props = $props();

  let searchInput: HTMLInputElement | undefined = $state();
  let selectedIndex = $state(0);
  let filterText = $state('');
  let activeTag: string | null = $state(null);

  let wsPath = '';
  currentWorkspace.subscribe((w) => (wsPath = w?.path ?? ''));

  let notes: ProcessedNoteInfo[] = [];
  filteredArchive.subscribe((n) => (notes = n));

  let tags: string[] = [];
  allTags.subscribe((t) => (tags = t));

  let loading = false;
  archiveStore.subscribe((s) => (loading = s.loading));

  // Group notes by date
  let groupedNotes = $derived(groupByDate(notes));

  // Flat list for keyboard navigation
  let flatNotes = $derived(notes);

  $effect(() => {
    if (show && wsPath) {
      archiveStore.load(wsPath);
      filterText = '';
      activeTag = null;
      selectedIndex = 0;
      setTimeout(() => searchInput?.focus(), 50);
    }
  });

  $effect(() => {
    archiveStore.setFilterText(filterText);
    selectedIndex = 0;
  });

  $effect(() => {
    archiveStore.setFilterTag(activeTag);
    selectedIndex = 0;
  });

  function groupByDate(items: ProcessedNoteInfo[]): { date: string; notes: ProcessedNoteInfo[] }[] {
    const groups = new Map<string, ProcessedNoteInfo[]>();
    for (const note of items) {
      const dateStr = note.processedAt ? formatDateGroup(note.processedAt) : 'Unknown date';
      if (!groups.has(dateStr)) {
        groups.set(dateStr, []);
      }
      groups.get(dateStr)!.push(note);
    }
    return Array.from(groups.entries()).map(([date, notes]) => ({ date, notes }));
  }

  function formatDateGroup(isoDate: string): string {
    try {
      const d = new Date(isoDate);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const noteDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const diffDays = Math.floor((today.getTime() - noteDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';

      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return 'Unknown date';
    }
  }

  function relativeTime(isoDate: string): string {
    try {
      const d = new Date(isoDate);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      const diffHr = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMin < 1) return 'just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHr < 24) return `${diffHr}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  }

  function truncate(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen).trimEnd() + '...';
  }

  function close() {
    show = false;
    filterText = '';
    activeTag = null;
    archiveStore.reset();
  }

  function toggleTag(tag: string) {
    activeTag = activeTag === tag ? null : tag;
  }

  async function openNote(note: ProcessedNoteInfo) {
    close();
    try {
      let dirty = false;
      isNoteDirty.subscribe((d) => (dirty = d))();
      if (dirty) {
        await autoSaveStore.saveNow();
      }

      await sessionStore.stopTracking();

      const separator = wsPath.includes('\\') ? '\\' : '/';
      const absolutePath = wsPath + separator + note.notePath;

      const invoke = await getInvoke();
      const content = await invoke<string>('read_file', { path: absolutePath });
      noteStore.openNote(absolutePath, content);

      await sessionStore.startTracking(absolutePath);
      await fileStatusStore.refresh();
    } catch (e) {
      console.error('Failed to open note from archive:', e);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      close();
      e.preventDefault();
    }
    if (e.key === 'ArrowDown') {
      selectedIndex = Math.min(selectedIndex + 1, flatNotes.length - 1);
      e.preventDefault();
      scrollSelectedIntoView();
    }
    if (e.key === 'ArrowUp') {
      selectedIndex = Math.max(selectedIndex - 1, 0);
      e.preventDefault();
      scrollSelectedIntoView();
    }
    if (e.key === 'Enter' && flatNotes.length > 0) {
      openNote(flatNotes[selectedIndex]);
      e.preventDefault();
    }
  }

  function scrollSelectedIntoView() {
    requestAnimationFrame(() => {
      const el = document.querySelector(`.archive-card[data-index="${selectedIndex}"]`);
      el?.scrollIntoView({ block: 'nearest' });
    });
  }

  function getCardIndex(note: ProcessedNoteInfo): number {
    return flatNotes.indexOf(note);
  }

  // Simple tag color generation based on hash
  function getTagColor(tag: string): string {
    const colors = [
      '#4ec9b0', '#569cd6', '#c586c0', '#ce9178',
      '#dcdcaa', '#9cdcfe', '#d7ba7d', '#6a9955',
    ];
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = ((hash << 5) - hash + tag.charCodeAt(i)) | 0;
    }
    return colors[Math.abs(hash) % colors.length];
  }

  function getTagBgColor(tag: string): string {
    const color = getTagColor(tag);
    return color + '1a'; // ~10% opacity hex
  }
</script>

{#if show}
  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events, a11y_interactive_supports_focus -->
  <div class="overlay" onclick={close} onkeydown={handleKeydown} role="dialog" aria-label="Archive" tabindex="-1">
    <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
    <div class="archive-modal" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
      <div class="archive-header">
        <span class="archive-title">Archive</span>
        <button class="close-btn" onclick={close} title="Close (Escape)">
          <span>&times;</span>
        </button>
      </div>

      <div class="search-bar">
        <span class="search-icon">&#128269;</span>
        <input
          bind:this={searchInput}
          type="text"
          class="search-input"
          placeholder="Search processed notes..."
          bind:value={filterText}
          onkeydown={handleKeydown}
        />
      </div>

      {#if tags.length > 0}
        <div class="tag-bar">
          <span class="tag-label">Tags:</span>
          <button
            class="tag-chip"
            class:active={activeTag === null}
            onclick={() => (activeTag = null)}
          >
            all
          </button>
          {#each tags as tag}
            <button
              class="tag-chip"
              class:active={activeTag === tag}
              style="--tag-color: {getTagColor(tag)}; --tag-bg: {getTagBgColor(tag)};"
              onclick={() => toggleTag(tag)}
            >
              {tag}
            </button>
          {/each}
        </div>
      {/if}

      <div class="archive-content">
        {#if loading}
          <div class="empty-state">Loading...</div>
        {:else if notes.length === 0 && (filterText || activeTag)}
          <div class="empty-state">No matching notes found.</div>
        {:else if notes.length === 0}
          <div class="empty-state">
            No processed notes yet. Process a note to see it here.
          </div>
        {:else}
          {#each groupedNotes as group}
            <div class="date-separator">
              <span class="date-text">{group.date}</span>
            </div>
            {#each group.notes as note}
              {@const idx = getCardIndex(note)}
              <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
              <div
                class="archive-card"
                class:selected={idx === selectedIndex}
                data-index={idx}
                onclick={() => openNote(note)}
                onmouseenter={() => (selectedIndex = idx)}
              >
                <div class="card-header">
                  <span class="card-title">{note.noteName}</span>
                  {#if note.processedAt}
                    <span class="card-time">{relativeTime(note.processedAt)}</span>
                  {/if}
                </div>
                {#if note.tldr}
                  <div class="card-tldr">{truncate(note.tldr, 150)}</div>
                {/if}
                <div class="card-footer">
                  {#if note.tags.length > 0}
                    <div class="card-tags">
                      {#each note.tags as tag}
                        <span
                          class="card-tag"
                          style="color: {getTagColor(tag)}; background: {getTagBgColor(tag)};"
                        >
                          {tag}
                        </span>
                      {/each}
                    </div>
                  {/if}
                  <div class="card-counts">
                    {#if note.actionCount > 0}
                      <span class="count-item">{note.actionCount} action{note.actionCount !== 1 ? 's' : ''}</span>
                    {/if}
                    {#if note.actionCount > 0 && note.questionCount > 0}
                      <span class="count-sep">&middot;</span>
                    {/if}
                    {#if note.questionCount > 0}
                      <span class="count-item">{note.questionCount} question{note.questionCount !== 1 ? 's' : ''}</span>
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
          {/each}
        {/if}
      </div>

      {#if notes.length > 0}
        <div class="archive-footer">
          <span class="footer-count">{notes.length} processed note{notes.length !== 1 ? 's' : ''}</span>
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
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }

  .archive-modal {
    background: var(--bg-secondary, #252525);
    border: 1px solid var(--border-color, #333);
    border-radius: 8px;
    width: 80vw;
    max-width: 900px;
    height: 80vh;
    max-height: 700px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    overflow: hidden;
  }

  .archive-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color, #333);
    background: var(--header-bg, #252525);
    flex-shrink: 0;
  }

  .archive-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary, #e0e0e0);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: transparent;
    border: none;
    color: var(--text-muted, #888);
    cursor: pointer;
    border-radius: 4px;
    font-size: 18px;
  }

  .close-btn:hover {
    background: var(--hover-bg, #333);
    color: var(--text-primary, #e0e0e0);
  }

  .search-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--border-color, #333);
    flex-shrink: 0;
  }

  .search-icon {
    font-size: 14px;
    color: var(--text-muted, #888);
  }

  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    font-size: 14px;
    font-family: var(--font-family);
    color: var(--text-primary, #e0e0e0);
  }

  .search-input::placeholder {
    color: var(--text-muted, #888);
    opacity: 0.6;
  }

  .tag-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--border-color, #333);
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  .tag-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted, #888);
    margin-right: 4px;
  }

  .tag-chip {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    border: 1px solid var(--border-color, #333);
    background: transparent;
    color: var(--tag-color, var(--text-secondary, #b0b0b0));
    cursor: pointer;
    transition: background 0.1s, border-color 0.1s;
    white-space: nowrap;
  }

  .tag-chip:hover {
    background: var(--tag-bg, var(--hover-bg, #333));
    border-color: var(--tag-color, var(--text-muted, #888));
  }

  .tag-chip.active {
    background: var(--tag-bg, var(--hover-bg, #333));
    border-color: var(--tag-color, var(--accent-color, #0078d4));
    color: var(--tag-color, var(--accent-color, #0078d4));
    font-weight: 600;
  }

  .archive-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px 16px;
    min-height: 0;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 120px;
    color: var(--text-muted, #888);
    font-size: 13px;
  }

  .date-separator {
    display: flex;
    align-items: center;
    margin: 16px 0 8px;
    gap: 12px;
  }

  .date-separator::before,
  .date-separator::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border-color, #333);
  }

  .date-text {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted, #888);
    white-space: nowrap;
  }

  .archive-card {
    padding: 10px 12px;
    border: 1px solid var(--border-color, #333);
    border-radius: 6px;
    margin-bottom: 6px;
    cursor: pointer;
    transition: background 0.08s, border-color 0.08s;
  }

  .archive-card:hover,
  .archive-card.selected {
    background: var(--hover-bg, #333);
    border-color: var(--text-muted, #555);
  }

  .archive-card.selected {
    border-color: var(--accent-color, #0078d4);
  }

  .card-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;
  }

  .card-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary, #e0e0e0);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .card-time {
    font-size: 11px;
    color: var(--text-muted, #888);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .card-tldr {
    font-size: 12px;
    color: var(--text-secondary, #b0b0b0);
    line-height: 1.4;
    margin-bottom: 6px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    min-width: 0;
  }

  .card-tag {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 8px;
    white-space: nowrap;
  }

  .card-counts {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .count-item {
    font-size: 11px;
    color: var(--text-muted, #888);
    white-space: nowrap;
  }

  .count-sep {
    font-size: 11px;
    color: var(--text-muted, #888);
  }

  .archive-footer {
    padding: 6px 16px;
    border-top: 1px solid var(--border-color, #333);
    flex-shrink: 0;
  }

  .footer-count {
    font-size: 11px;
    color: var(--text-muted, #888);
  }
</style>
