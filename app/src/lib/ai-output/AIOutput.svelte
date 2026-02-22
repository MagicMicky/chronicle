<script lang="ts">
  import { uiStore } from '$lib/stores/ui';
  import {
    aiOutputStore,
    aiResult,
    isAIProcessing,
    aiError,
    hasAIResult,
    isLoadingSections,
    resetAIPanelOverride,
    setAIPanelManualOverride,
    type AIResult,
  } from '$lib/stores/aiOutput';
  import { currentNote } from '$lib/stores/note';
  import { currentWorkspace } from '$lib/stores/workspace';
  import Summary from './Summary.svelte';
  import KeyPoints from './KeyPoints.svelte';
  import ActionList from './ActionList.svelte';
  import Questions from './Questions.svelte';
  import { Bot, Sparkles, AlertCircle, Minus, Link, Copy, Download, Users, Gavel } from 'lucide-svelte';
  import type { Entities } from '$lib/stores/aiOutput';
  import { relatedNotes, linksStore } from '$lib/stores/links';
  import { invoke } from '@tauri-apps/api/core';
  import { toast } from '$lib/stores/toast';

  let result: AIResult | null = $state(null);
  let processing = $state(false);
  let error: string | null = $state(null);
  let hasResult = $state(false);
  let loadingSections = $state(false);
  let showRaw = $state(false);
  let currentPath: string | null = $state(null);
  let workspacePath: string | null = $state(null);
  let related: string[] = $state([]);

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
        // Reset manual override on file switch so auto behavior kicks in
        resetAIPanelOverride();
        // Auto-collapse since we just cleared (no processed content for new file)
        uiStore.setCollapsed('aiOutput', true);
      }
    })
  );
  $effect(() =>
    currentWorkspace.subscribe((ws) => {
      workspacePath = ws?.path ?? null;
    })
  );
  $effect(() =>
    relatedNotes.subscribe((r) => {
      related = r;
    })
  );

  // Load processed content from .chronicle/processed/ when file changes
  $effect(() => {
    if (currentPath && workspacePath) {
      loadProcessedFromChronicle(currentPath, workspacePath);
    }
  });

  async function loadProcessedFromChronicle(notePath: string, wsPath: string) {
    const filename = notePath.split('/').pop()?.replace(/\.md$/, '') ?? '';
    if (!filename) return;
    try {
      const data = await invoke<Record<string, unknown> | null>('read_processed', {
        workspacePath: wsPath,
        noteName: filename,
      });
      if (data && typeof data === 'object' && data.tldr) {
        // We have processed data from .chronicle/processed/
        const entities = data.entities as Entities | undefined;
        const sections = {
          tldr: (data.tldr as string) ?? null,
          keyPoints: ((data.keyPoints as Array<unknown>) ?? []).map((kp: unknown) =>
            typeof kp === 'string' ? { text: kp } : { text: (kp as { text: string }).text, sourceLines: (kp as { sourceLines?: number[] }).sourceLines }
          ),
          actions: ((data.actionItems as Array<{ text: string; owner?: string; done?: boolean; sourceLine?: number }>) ?? []).map((a) => ({
            text: a.text,
            owner: a.owner ?? null,
            completed: a.done ?? false,
            sourceLine: a.sourceLine,
          })),
          questions: ((data.questions as Array<unknown>) ?? []).map((q: unknown) =>
            typeof q === 'string' ? { text: q } : { text: (q as { text: string }).text, sourceLine: (q as { sourceLine?: number }).sourceLine }
          ),
          rawNotes: null,
          entities: entities ?? undefined,
        };
        aiOutputStore.setResult({
          path: notePath,
          processedAt: data.processedAt ? new Date(data.processedAt as string) : new Date(),
          summary: (data.tldr as string) ?? '',
          style: 'standard',
          tokens: { input: 0, output: 0 },
          sections,
        });
      }
    } catch {
      // No processed content for this note yet
    }
  }

  function handleRelatedClick(notePath: string) {
    if (!workspacePath) return;
    const fullPath = notePath.startsWith('/') ? notePath : `${workspacePath}/${notePath}`;
    // Navigate to the related note by dispatching to the explorer's file click handler
    window.dispatchEvent(new CustomEvent('chronicle:open-file', { detail: { path: fullPath } }));
  }

  function handleCollapse() {
    setAIPanelManualOverride();
    uiStore.toggleCollapse('aiOutput');
  }

  function handleDismissError() {
    aiOutputStore.setError('');
  }

  async function handleRetry() {
    if (!currentPath || !workspacePath) return;
    aiOutputStore.setProcessing(true);
    try {
      await invoke('process_note', { workspacePath, notePath: currentPath });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      aiOutputStore.setError(msg);
    }
  }

  function toggleRaw() {
    showRaw = !showRaw;
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function buildFullMarkdown(): string {
    if (!result?.sections) return '';
    const parts: string[] = [];
    if (result.sections.tldr) {
      parts.push(`## TL;DR\n\n${result.sections.tldr}`);
    }
    if (result.sections.keyPoints.length > 0) {
      parts.push(`## Key Points\n\n${result.sections.keyPoints.map((p) => `- ${p.text}`).join('\n')}`);
    }
    if (result.sections.actions.length > 0) {
      parts.push(
        `## Action Items\n\n${result.sections.actions.map((a) => `- [${a.completed ? 'x' : ' '}] ${a.text}${a.owner ? ` (@${a.owner})` : ''}`).join('\n')}`
      );
    }
    if (result.sections.questions.length > 0) {
      parts.push(`## Open Questions\n\n${result.sections.questions.map((q) => `- ${q.text}`).join('\n')}`);
    }
    return parts.join('\n\n');
  }

  async function handleCopySummary() {
    const md = buildFullMarkdown();
    if (!md) return;
    try {
      await navigator.clipboard.writeText(md);
      toast.success('Copied!', 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }

  async function handleExport() {
    if (!result?.sections || !currentPath || !workspacePath) return;
    const md = buildFullMarkdown();
    if (!md) return;
    const filename = currentPath.split('/').pop() ?? '';
    const exportName = filename.replace(/\.md$/, '.processed.md');
    const dir = currentPath.substring(0, currentPath.lastIndexOf('/'));
    const exportPath = `${dir}/${exportName}`;
    try {
      await invoke('write_file', { path: exportPath, content: md });
      toast.success(`Exported to ${exportName}`, 3000);
    } catch {
      toast.error('Failed to export');
    }
  }
</script>

<div class="ai-output">
  <div class="pane-header">
    <span class="pane-title">AI Output</span>
    <div class="header-actions">
      {#if hasResult && result?.sections}
        <button
          class="icon-btn"
          onclick={handleCopySummary}
          title="Copy Summary"
          aria-label="Copy Summary"
        >
          <Copy size={13} />
        </button>
        <button
          class="icon-btn"
          onclick={handleExport}
          title="Export as .processed.md"
          aria-label="Export processed note"
        >
          <Download size={13} />
        </button>
        <button
          class="action-btn"
          class:active={showRaw}
          onclick={toggleRaw}
          title="Toggle Raw Notes"
          aria-label="Toggle Raw Notes"
        >
          Raw
        </button>
      {/if}
      <button class="collapse-btn" onclick={handleCollapse} title="Collapse AI Output" aria-label="Collapse AI Output">
        <Minus size={14} />
      </button>
    </div>
  </div>

  <div class="pane-content">
    {#if processing}
      <!-- Processing state -->
      <div class="state-container processing">
        <span class="processing-icon"><Sparkles size={20} /></span>
        <div class="spinner"></div>
        <span class="state-text">Processing note...</span>
      </div>
    {:else if error}
      <!-- Error state -->
      <div class="state-container error">
        <span class="error-icon"><AlertCircle size={32} /></span>
        <span class="error-text">{error}</span>
        <div class="error-actions">
          <button class="retry-btn" onclick={handleRetry}>Retry</button>
          <button class="dismiss-btn" onclick={handleDismissError}>Dismiss</button>
        </div>
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

        {#if result.sections.entities && (
          (result.sections.entities.people?.length ?? 0) > 0 ||
          (result.sections.entities.decisions?.length ?? 0) > 0
        )}
          <section class="ai-section entities-section">
            {#if result.sections.entities.people?.length}
              <h3 class="section-title">
                <Users size={12} />
                People Mentioned
              </h3>
              <ul class="entity-list">
                {#each result.sections.entities.people as person}
                  <li class="entity-item">
                    <strong class="entity-name">{person.name}</strong>
                    {#if person.role}<span class="entity-role"> -- {person.role}</span>{/if}
                  </li>
                {/each}
              </ul>
            {/if}

            {#if result.sections.entities.decisions?.length}
              <h3 class="section-title decisions-title">
                <Gavel size={12} />
                Decisions
              </h3>
              <ul class="entity-list">
                {#each result.sections.entities.decisions as decision}
                  <li class="entity-item">
                    <span class="decision-text">{decision.text}</span>
                    {#if decision.participants?.length}
                      <span class="entity-participants">({decision.participants.join(', ')})</span>
                    {/if}
                  </li>
                {/each}
              </ul>
            {/if}

            {#if result.sections.entities.topics?.length}
              <div class="entity-topics">
                {#each result.sections.entities.topics as topic}
                  <span class="entity-topic-pill">{topic}</span>
                {/each}
              </div>
            {/if}
          </section>
        {/if}

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
        <span class="state-icon"><Bot size={32} /></span>
        <span class="state-text">Ready to process</span>
        <span class="state-hint">Press Cmd/Ctrl+Enter or click Process in the status bar</span>
      </div>
    {/if}

    <!-- Related Notes (shown if there are any, regardless of processing state) -->
    {#if related.length > 0}
      <section class="related-notes">
        <h3 class="related-title">
          <Link size={12} />
          Related Notes
        </h3>
        <div class="related-list">
          {#each related as notePath (notePath)}
            <button
              class="related-item"
              onclick={() => handleRelatedClick(notePath)}
              title={notePath}
            >
              {notePath.split('/').pop()?.replace(/\.md$/, '') ?? notePath}
            </button>
          {/each}
        </div>
      </section>
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

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    background: transparent;
    border: none;
    color: var(--text-muted, #888);
    cursor: pointer;
    border-radius: 3px;
  }

  .icon-btn:hover {
    background: var(--hover-bg, #333);
    color: var(--text-primary, #fff);
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
    color: var(--error-color, #f14c4c);
  }

  .processing-icon {
    color: var(--accent-color, #0078d4);
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }

  .error-text {
    font-size: 13px;
    text-align: center;
    max-width: 80%;
    color: var(--text-primary, #e0e0e0);
  }

  .error-actions {
    display: flex;
    gap: 8px;
  }

  .retry-btn {
    font-size: 12px;
    padding: 6px 16px;
    background: var(--accent-color, #0078d4);
    border: 1px solid var(--accent-color, #0078d4);
    color: #fff;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s;
  }

  .retry-btn:hover {
    background: var(--accent-hover, #1a8ae8);
    border-color: var(--accent-hover, #1a8ae8);
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

  /* Entities section */
  .entities-section :global(.section-title) {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .decisions-title {
    margin-top: 12px !important;
  }

  .entity-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .entity-item {
    font-size: 12px;
    color: var(--text-secondary, #ccc);
    line-height: 1.4;
  }

  .entity-name {
    color: var(--text-primary, #e0e0e0);
  }

  .entity-role {
    color: var(--text-muted, #888);
    font-style: italic;
  }

  .decision-text {
    color: var(--text-secondary, #ccc);
  }

  .entity-participants {
    font-size: 11px;
    color: var(--text-muted, #888);
    margin-left: 4px;
  }

  .entity-topics {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 12px;
  }

  .entity-topic-pill {
    display: inline-block;
    padding: 2px 8px;
    font-size: 11px;
    background: var(--hover-bg, #2a2a2a);
    border: 1px solid var(--border-color, #333);
    border-radius: 12px;
    color: var(--text-secondary, #ccc);
  }

  /* Related Notes */
  .related-notes {
    padding: 12px 16px;
    border-top: 1px solid var(--border-color, #333);
  }

  .related-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted, #888);
    margin: 0 0 8px 0;
  }

  .related-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .related-item {
    display: block;
    padding: 4px 8px;
    font-size: 12px;
    color: var(--accent-color, #0078d4);
    background: transparent;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    text-align: left;
    text-decoration: none;
    transition: background 0.15s;
  }

  .related-item:hover {
    background: var(--hover-bg, #333);
    text-decoration: underline;
  }
</style>
