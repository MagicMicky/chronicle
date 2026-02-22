<script lang="ts">
  import { onMount } from 'svelte';
  import {
    actionsStore,
    actionItems,
    openActions,
    overdueActions,
    doneActions,
    actionSummary,
    actionsLastLoaded,
  } from '$lib/stores/actions';
  import { noteStore } from '$lib/stores/note';

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();

  type GroupMode = 'status' | 'owner' | 'source';
  type FilterStatus = 'all' | 'open' | 'done' | 'overdue';

  let groupMode: GroupMode = $state('status');
  let filterStatus: FilterStatus = $state('all');
  let filterOwner: string = $state('');
  let filterSource: string = $state('');
  let selectedIndex: number = $state(-1);

  // Derived values
  let items = $derived($actionItems);
  let summary = $derived($actionSummary);
  let lastLoaded = $derived($actionsLastLoaded);

  // Unique owners and sources for filters
  let owners = $derived([...new Set(items.map((a) => a.owner).filter(Boolean))].sort());
  let sources = $derived([...new Set(items.map((a) => a.source).filter(Boolean))].sort());

  // Filtered items
  let filteredItems = $derived.by(() => {
    let result = items;

    if (filterStatus === 'open') {
      result = result.filter((a) => a.status === 'open' && !isOverdue(a));
    } else if (filterStatus === 'done') {
      result = result.filter((a) => a.status === 'done');
    } else if (filterStatus === 'overdue') {
      result = result.filter((a) => a.status === 'open' && isOverdue(a));
    }

    if (filterOwner) {
      result = result.filter((a) => a.owner === filterOwner);
    }
    if (filterSource) {
      result = result.filter((a) => a.source === filterSource);
    }

    return result;
  });

  // Grouped items
  interface GroupedActions {
    label: string;
    items: { action: import('$lib/stores/actions').ActionItem; originalIndex: number }[];
  }

  let grouped = $derived.by((): GroupedActions[] => {
    // Map filtered items back to their original indices
    const withIndices = filteredItems.map((action) => ({
      action,
      originalIndex: items.indexOf(action),
    }));

    if (groupMode === 'status') {
      const overdue = withIndices.filter((a) => a.action.status === 'open' && isOverdue(a.action));
      const open = withIndices.filter((a) => a.action.status === 'open' && !isOverdue(a.action));
      const done = withIndices.filter((a) => a.action.status === 'done');
      const groups: GroupedActions[] = [];
      if (open.length > 0) groups.push({ label: 'Open', items: open });
      if (overdue.length > 0) groups.push({ label: 'Overdue', items: overdue });
      if (done.length > 0) groups.push({ label: 'Done', items: done });
      return groups;
    }

    if (groupMode === 'owner') {
      const byOwner = new Map<string, GroupedActions['items']>();
      for (const item of withIndices) {
        const key = item.action.owner || 'Unassigned';
        if (!byOwner.has(key)) byOwner.set(key, []);
        byOwner.get(key)!.push(item);
      }
      return Array.from(byOwner.entries()).map(([label, items]) => ({ label, items }));
    }

    // By source
    const bySource = new Map<string, GroupedActions['items']>();
    for (const item of withIndices) {
      const key = item.action.source || 'Unknown';
      if (!bySource.has(key)) bySource.set(key, []);
      bySource.get(key)!.push(item);
    }
    return Array.from(bySource.entries()).map(([label, items]) => ({ label, items }));
  });

  function isOverdue(action: import('$lib/stores/actions').ActionItem): boolean {
    if (action.status !== 'open') return false;
    const created = new Date(action.created);
    const daysOld = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
    return daysOld > 7;
  }

  function getAge(dateStr: string): string {
    const created = new Date(dateStr);
    const diffMs = Date.now() - created.getTime();
    const diffMin = Math.floor(diffMs / (1000 * 60));
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d ago`;
    const diffW = Math.floor(diffD / 7);
    return `${diffW}w ago`;
  }

  function getLastUpdatedText(): string {
    if (!lastLoaded) return '';
    const diffMs = Date.now() - lastLoaded.getTime();
    const diffMin = Math.floor(diffMs / (1000 * 60));
    if (diffMin < 1) return 'just now';
    return `${diffMin} min ago`;
  }

  function handleToggle(originalIndex: number) {
    actionsStore.toggleStatus(originalIndex);
  }

  function handleSourceClick(source: string) {
    // Dispatch event to open file, then close modal
    window.dispatchEvent(new CustomEvent('chronicle:open-file', { detail: { path: source } }));
    onClose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }

  function handleOverlayClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) {
      onClose();
    }
  }

  onMount(() => {
    actionsStore.load();
  });

  // Color for owner badges (deterministic from name)
  function ownerColor(name: string): string {
    const colors = [
      '#4ec9b0', '#569cd6', '#ce9178', '#dcdcaa',
      '#c586c0', '#9cdcfe', '#d7ba7d', '#b5cea8',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="modal-overlay"
  role="dialog"
  aria-modal="true"
  aria-label="Action Items"
  onkeydown={handleKeydown}
  onclick={handleOverlayClick}
>
  <div class="modal-card">
    <!-- Header -->
    <div class="modal-header">
      <div class="header-left">
        <h2>Action Items</h2>
        <span class="header-counts">
          {summary.open} open
          {#if summary.overdue > 0}
            <span class="count-separator">&middot;</span>
            <span class="count-overdue">{summary.overdue} overdue</span>
          {/if}
          <span class="count-separator">&middot;</span>
          {summary.done} done
        </span>
      </div>
      <button class="close-btn" onclick={onClose} aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </div>

    <!-- Filter bar -->
    <div class="filter-bar">
      <div class="filter-group">
        <label for="filter-status">Status</label>
        <select id="filter-status" bind:value={filterStatus}>
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="done">Done</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>

      {#if owners.length > 0}
        <div class="filter-group">
          <label for="filter-owner">Owner</label>
          <select id="filter-owner" bind:value={filterOwner}>
            <option value="">All</option>
            {#each owners as owner}
              <option value={owner}>{owner}</option>
            {/each}
          </select>
        </div>
      {/if}

      {#if sources.length > 0}
        <div class="filter-group">
          <label for="filter-source">Source</label>
          <select id="filter-source" bind:value={filterSource}>
            <option value="">All</option>
            {#each sources as source}
              <option value={source}>{source.split('/').pop()}</option>
            {/each}
          </select>
        </div>
      {/if}

      <div class="group-toggle">
        <button
          class="group-btn"
          class:active={groupMode === 'status'}
          onclick={() => (groupMode = 'status')}
        >Status</button>
        <button
          class="group-btn"
          class:active={groupMode === 'owner'}
          onclick={() => (groupMode = 'owner')}
        >Owner</button>
        <button
          class="group-btn"
          class:active={groupMode === 'source'}
          onclick={() => (groupMode = 'source')}
        >Source</button>
      </div>
    </div>

    <!-- Main content -->
    <div class="modal-body">
      {#if items.length === 0}
        <div class="empty-state">
          <p class="empty-title">No action items yet</p>
          <p class="empty-desc">Action items will appear here after processing notes with Chronicle.</p>
        </div>
      {:else if filteredItems.length === 0}
        <div class="empty-state">
          <p class="empty-title">No matching actions</p>
          <p class="empty-desc">Try adjusting your filters.</p>
        </div>
      {:else}
        {#each grouped as group}
          <div class="action-group">
            <div class="group-label">{group.label}</div>
            {#each group.items as { action, originalIndex }}
              <div
                class="action-item"
                class:done={action.status === 'done'}
                class:overdue={isOverdue(action)}
              >
                <button
                  class="action-checkbox"
                  onclick={() => handleToggle(originalIndex)}
                  aria-label={action.status === 'done' ? 'Mark as open' : 'Mark as done'}
                >
                  {#if action.status === 'done'}
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <rect x="1" y="1" width="14" height="14" rx="3" stroke="var(--success-color)" stroke-width="1.5" fill="var(--success-color)" fill-opacity="0.15" />
                      <path d="M4.5 8l2.5 2.5 4.5-5" stroke="var(--success-color)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  {:else}
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <rect x="1" y="1" width="14" height="14" rx="3" stroke={isOverdue(action) ? 'var(--error-color)' : 'var(--text-muted)'} stroke-width="1.5" />
                    </svg>
                  {/if}
                </button>

                <div class="action-content">
                  <span class="action-text">{action.text}</span>
                  <div class="action-meta">
                    {#if action.owner}
                      <span
                        class="owner-badge"
                        style="--badge-color: {ownerColor(action.owner)}"
                      >{action.owner}</span>
                    {/if}
                    {#if action.source}
                      <button
                        class="source-link"
                        onclick={() => handleSourceClick(action.source)}
                      >{action.source.split('/').pop()}</button>
                    {/if}
                    <span class="action-age">{getAge(action.created)}</span>
                  </div>
                </div>

                <span class="status-dot" class:dot-done={action.status === 'done'} class:dot-overdue={isOverdue(action)}></span>
              </div>
            {/each}
          </div>
        {/each}
      {/if}
    </div>

    <!-- Footer -->
    {#if lastLoaded}
      <div class="modal-footer">
        Last updated: {getLastUpdatedText()}
      </div>
    {/if}
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-card {
    background: var(--bg-secondary, #252525);
    border: 1px solid var(--border-color, #333);
    border-radius: 8px;
    width: 640px;
    max-width: 90vw;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color, #333);
    flex-shrink: 0;
  }

  .header-left {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  .modal-header h2 {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary, #e0e0e0);
    margin: 0;
  }

  .header-counts {
    font-size: var(--font-size-sm, 12px);
    color: var(--text-muted, #888);
  }

  .count-separator {
    margin: 0 4px;
  }

  .count-overdue {
    color: var(--error-color, #f14c4c);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 4px;
    color: var(--text-muted, #888);
    transition: background 0.15s, color 0.15s;
  }

  .close-btn:hover {
    background: var(--hover-bg, #333);
    color: var(--text-primary, #e0e0e0);
  }

  /* Filter bar */
  .filter-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 20px;
    border-bottom: 1px solid var(--border-color, #333);
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  .filter-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .filter-group label {
    font-size: var(--font-size-xs, 11px);
    color: var(--text-muted, #888);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .filter-group select {
    background: var(--bg-tertiary, #2d2d2d);
    color: var(--text-primary, #e0e0e0);
    border: 1px solid var(--border-color, #333);
    border-radius: 4px;
    padding: 3px 8px;
    font-size: var(--font-size-sm, 12px);
    font-family: inherit;
    cursor: pointer;
  }

  .filter-group select:focus {
    outline: none;
    border-color: var(--accent-color, #0078d4);
  }

  .group-toggle {
    display: flex;
    gap: 2px;
    margin-left: auto;
    background: var(--bg-tertiary, #2d2d2d);
    border-radius: 4px;
    padding: 2px;
  }

  .group-btn {
    font-size: var(--font-size-xs, 11px);
    padding: 3px 8px;
    border-radius: 3px;
    color: var(--text-muted, #888);
    transition: background 0.15s, color 0.15s;
  }

  .group-btn:hover {
    color: var(--text-secondary, #b0b0b0);
  }

  .group-btn.active {
    background: var(--accent-color, #0078d4);
    color: white;
  }

  /* Body */
  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 20px;
    text-align: center;
  }

  .empty-title {
    font-size: 14px;
    color: var(--text-secondary, #b0b0b0);
    margin-bottom: 8px;
  }

  .empty-desc {
    font-size: var(--font-size-sm, 12px);
    color: var(--text-muted, #888);
  }

  /* Action groups */
  .action-group {
    margin-bottom: 4px;
  }

  .group-label {
    font-size: var(--font-size-xs, 11px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted, #888);
    padding: 8px 20px 4px;
  }

  /* Action items */
  .action-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 8px 20px;
    transition: background 0.1s;
  }

  .action-item:hover {
    background: var(--hover-bg, #333);
  }

  .action-item.done .action-text {
    text-decoration: line-through;
    opacity: 0.6;
  }

  .action-checkbox {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    margin-top: 1px;
    padding: 2px;
    border-radius: 4px;
    transition: background 0.15s;
  }

  .action-checkbox:hover {
    background: var(--hover-bg, #333);
  }

  .action-content {
    flex: 1;
    min-width: 0;
  }

  .action-text {
    font-size: var(--font-size-base, 14px);
    color: var(--text-primary, #e0e0e0);
    line-height: 1.4;
    display: block;
  }

  .action-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
    flex-wrap: wrap;
  }

  .owner-badge {
    font-size: var(--font-size-xs, 11px);
    padding: 1px 6px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--badge-color) 20%, transparent);
    color: var(--badge-color);
    white-space: nowrap;
  }

  .source-link {
    font-size: var(--font-size-xs, 11px);
    color: var(--accent-color, #0078d4);
    padding: 0;
    white-space: nowrap;
  }

  .source-link:hover {
    text-decoration: underline;
  }

  .action-age {
    font-size: var(--font-size-xs, 11px);
    color: var(--text-muted, #888);
    white-space: nowrap;
  }

  .status-dot {
    flex-shrink: 0;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--warning-color, #cca700);
    margin-top: 6px;
  }

  .status-dot.dot-done {
    background: var(--success-color, #4ec9b0);
  }

  .status-dot.dot-overdue {
    background: var(--error-color, #f14c4c);
  }

  /* Footer */
  .modal-footer {
    padding: 10px 20px;
    border-top: 1px solid var(--border-color, #333);
    font-size: var(--font-size-xs, 11px);
    color: var(--text-muted, #888);
    text-align: center;
    flex-shrink: 0;
  }
</style>
