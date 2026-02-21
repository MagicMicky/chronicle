<script lang="ts">
  import { uiStore } from '$lib/stores/ui';
  import {
    aiOutputStore,
    aiResult,
    isAIProcessing,
    aiError,
    hasAIResult,
    isLoadingSections,
    type AIResult,
  } from '$lib/stores/aiOutput';
  import { currentNote } from '$lib/stores/note';
  import { currentWorkspace } from '$lib/stores/workspace';
  import Summary from './Summary.svelte';
  import KeyPoints from './KeyPoints.svelte';
  import ActionList from './ActionList.svelte';
  import Questions from './Questions.svelte';

  let result: AIResult | null = $state(null);
  let processing = $state(false);
  let error: string | null = $state(null);
  let hasResult = $state(false);
  let loadingSections = $state(false);
  let showRaw = $state(false);
  let currentPath: string | null = $state(null);
  let workspacePath: string | null = $state(null);

  // Reactive store subscriptions — $effect auto-cleans up the returned unsubscribe
  $effect(() =>
    aiResult.subscribe((r) => {
      result = r;
      if (r && !r.sections && !loadingSections && workspacePath) {
        aiOutputStore.loadSections(`${workspacePath}/${r.path}`);
      }
    })
  );
  $effect(() => isAIProcessing.subscribe((p) => (processing = p)));
  $effect(() => aiError.subscribe((e) => (error = e)));
  $effect(() => hasAIResult.subscribe((h) => (hasResult = h)));
  $effect(() => isLoadingSections.subscribe((l) => (loadingSections = l)));
  $effect(() =>
    currentNote.subscribe((note) => {
      if (note?.path !== currentPath) {
        currentPath = note?.path ?? null;
        aiOutputStore.clear();
        showRaw = false;
      }
    })
  );
  $effect(() =>
    currentWorkspace.subscribe((ws) => {
      workspacePath = ws?.path ?? null;
    })
  );

  function handleCollapse() {
    uiStore.toggleCollapse('aiOutput');
  }

  function handleDismissError() {
    aiOutputStore.setError('');
  }

  function toggleRaw() {
    showRaw = !showRaw;
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
</script>

<div class="ai-output">
  <div class="pane-header">
    <span class="pane-title">AI Output</span>
    <div class="header-actions">
      {#if hasResult && result?.sections}
        <button
          class="action-btn"
          class:active={showRaw}
          onclick={toggleRaw}
          title="Toggle Raw Notes"
        >
          Raw
        </button>
      {/if}
      <button class="collapse-btn" onclick={handleCollapse} title="Collapse AI Output">
        <span class="icon">&#x2212;</span>
      </button>
    </div>
  </div>

  <div class="pane-content">
    {#if processing}
      <!-- Processing state -->
      <div class="state-container processing">
        <div class="spinner"></div>
        <span class="state-text">Processing note...</span>
      </div>
    {:else if error}
      <!-- Error state -->
      <div class="state-container error">
        <span class="error-icon">!</span>
        <span class="error-text">{error}</span>
        <button class="dismiss-btn" onclick={handleDismissError}>Dismiss</button>
      </div>
    {:else if loadingSections}
      <!-- Loading sections state -->
      <div class="state-container loading">
        <div class="spinner small"></div>
        <span class="state-text">Loading sections...</span>
      </div>
    {:else if hasResult && result?.sections}
      <!-- Result state -->
      <div class="sections-container">
        <Summary tldr={result.sections.tldr} />
        <KeyPoints points={result.sections.keyPoints} />
        <ActionList actions={result.sections.actions} />
        <Questions questions={result.sections.questions} />

        {#if showRaw && result.sections.rawNotes}
          <section class="ai-section raw-notes">
            <h3 class="section-title">Raw Notes</h3>
            <pre class="raw-content">{result.sections.rawNotes}</pre>
          </section>
        {/if}

        <div class="meta-info">
          <span class="meta-item">
            <span class="meta-label">Processed:</span>
            {formatTime(result.processedAt)}
          </span>
          <span class="meta-item">
            <span class="meta-label">Style:</span>
            {result.style}
          </span>
          <span class="meta-item">
            <span class="meta-label">Tokens:</span>
            {result.tokens.input} in / {result.tokens.output} out
          </span>
        </div>
      </div>
    {:else if hasResult && result && !result.sections}
      <!-- Result received but sections not loaded yet -->
      <div class="state-container loading">
        <div class="spinner small"></div>
        <span class="state-text">Loading sections...</span>
      </div>
    {:else}
      <!-- Ready state -->
      <div class="state-container ready">
        <span class="state-icon">&#129302;</span>
        <span class="state-text">Ready to process</span>
        <span class="state-hint">Press Cmd/Ctrl+Shift+P or click Process in the status bar</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .ai-output {
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
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .action-btn {
    font-size: 11px;
    padding: 2px 8px;
    background: transparent;
    border: 1px solid var(--border-color, #333);
    color: var(--text-muted, #888);
    cursor: pointer;
    border-radius: 3px;
    transition: all 0.15s;
  }

  .action-btn:hover {
    background: var(--hover-bg, #333);
    color: var(--text-primary, #fff);
  }

  .action-btn.active {
    background: var(--accent-color, #0078d4);
    border-color: var(--accent-color, #0078d4);
    color: #fff;
  }

  .collapse-btn {
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

  .collapse-btn:hover {
    background: var(--hover-bg, #333);
    color: var(--text-primary, #fff);
  }

  .pane-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: auto;
  }

  /* State containers */
  .state-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 20px;
  }

  .state-icon {
    font-size: 48px;
    opacity: 0.5;
  }

  .state-text {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-muted, #888);
  }

  .state-hint {
    font-size: 12px;
    color: var(--text-muted, #666);
    opacity: 0.7;
  }

  /* Spinner */
  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border-color, #333);
    border-top-color: var(--accent-color, #0078d4);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .spinner.small {
    width: 20px;
    height: 20px;
    border-width: 2px;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Error state */
  .state-container.error {
    color: var(--error-color, #f14c4c);
  }

  .error-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    font-size: 24px;
    font-weight: bold;
    background: var(--error-color, #f14c4c);
    color: #fff;
    border-radius: 50%;
  }

  .error-text {
    font-size: 13px;
    text-align: center;
    max-width: 80%;
    color: var(--text-primary, #e0e0e0);
  }

  .dismiss-btn {
    font-size: 12px;
    padding: 6px 16px;
    background: transparent;
    border: 1px solid var(--error-color, #f14c4c);
    color: var(--error-color, #f14c4c);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s;
  }

  .dismiss-btn:hover {
    background: var(--error-color, #f14c4c);
    color: #fff;
  }

  /* Sections container */
  .sections-container {
    display: flex;
    flex-direction: column;
  }

  /* Shared section styles scoped to children */
  .sections-container :global(.ai-section) {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color, #333);
  }

  .sections-container :global(.section-title) {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted, #888);
    margin: 0 0 8px 0;
  }

  .raw-notes {
    background: var(--bg-secondary, #252525);
  }

  .raw-content {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-secondary, #b0b0b0);
    margin: 0;
    white-space: pre-wrap;
    word-wrap: break-word;
    max-height: 300px;
    overflow: auto;
  }

  /* Meta info */
  .meta-info {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    padding: 12px 16px;
    background: var(--bg-secondary, #252525);
    border-top: 1px solid var(--border-color, #333);
  }

  .meta-item {
    font-size: 11px;
    color: var(--text-muted, #888);
  }

  .meta-label {
    color: var(--text-muted, #666);
    margin-right: 4px;
  }
</style>
