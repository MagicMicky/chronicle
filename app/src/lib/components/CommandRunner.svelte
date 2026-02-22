<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import {
    commandsStore,
    availableCommands,
    type CommandInfo,
  } from '$lib/stores/commands';
  import { currentWorkspace } from '$lib/stores/workspace';

  interface Props {
    onclose: () => void;
    preselectedCommand?: CommandInfo | null;
  }

  let { onclose, preselectedCommand = null }: Props = $props();

  let commands: CommandInfo[] = $state([]);
  let filter = $state('');
  let selectedCommand: CommandInfo | null = $state(preselectedCommand);
  let paramValues: Record<string, string> = $state({});
  let running = $state(false);
  let outputLines: string[] = $state([]);
  let exitCode: number | null = $state(null);
  let errorMessage: string | null = $state(null);
  let workspacePath: string | null = $state(null);

  let filterInput: HTMLInputElement | undefined = $state();
  let outputContainer: HTMLDivElement | undefined = $state();

  // Subscribe to stores
  $effect(() => availableCommands.subscribe((c) => (commands = c)));
  $effect(() =>
    currentWorkspace.subscribe((ws) => {
      workspacePath = ws?.path ?? null;
    })
  );

  // Auto-scroll output
  $effect(() => {
    if (outputLines.length && outputContainer) {
      outputContainer.scrollTop = outputContainer.scrollHeight;
    }
  });

  onMount(() => {
    // Focus filter input when modal opens (unless command is pre-selected)
    if (!selectedCommand) {
      filterInput?.focus();
    }

    // Load commands if workspace is available
    if (workspacePath) {
      commandsStore.load(workspacePath);
    }
  });

  let filteredCommands = $derived(
    filter.trim()
      ? commands.filter(
          (c) =>
            c.name.toLowerCase().includes(filter.toLowerCase()) ||
            c.description.toLowerCase().includes(filter.toLowerCase())
        )
      : commands
  );

  function selectCommand(cmd: CommandInfo) {
    selectedCommand = cmd;
    // Initialize param values
    paramValues = {};
    for (const param of cmd.params) {
      paramValues[param] = '';
    }
    outputLines = [];
    exitCode = null;
    errorMessage = null;
  }

  function goBack() {
    selectedCommand = null;
    paramValues = {};
    outputLines = [];
    exitCode = null;
    errorMessage = null;
    // Re-focus filter
    requestAnimationFrame(() => filterInput?.focus());
  }

  async function runCommand() {
    if (!selectedCommand || !workspacePath) return;

    // Validate required params (all non-date params)
    const missingParams = selectedCommand.params.filter(
      (p) => p !== 'date' && !paramValues[p]?.trim()
    );
    if (missingParams.length > 0) {
      errorMessage = `Missing required parameters: ${missingParams.join(', ')}`;
      return;
    }

    running = true;
    outputLines = [];
    exitCode = null;
    errorMessage = null;

    // Listen for streaming output
    let unlistenOutput: UnlistenFn | null = null;
    let unlistenComplete: UnlistenFn | null = null;

    try {
      unlistenOutput = await listen<string>('claude:output-line', (event) => {
        outputLines = [...outputLines, event.payload];
      });

      unlistenComplete = await listen<{ exitCode: number; outputLength: number }>(
        'claude:task-completed',
        (event) => {
          exitCode = event.payload.exitCode;
        }
      );

      // Build params, filtering out empty values
      const params: Record<string, string> = {};
      for (const [key, value] of Object.entries(paramValues)) {
        if (value.trim()) {
          params[key] = value.trim();
        }
      }

      const result = await invoke<{ output: string; exitCode: number }>(
        'run_custom_command',
        {
          workspacePath,
          commandFilename: selectedCommand.filename,
          params,
        }
      );

      exitCode = result.exitCode;
      // If output wasn't streamed, show it from the result
      if (outputLines.length === 0 && result.output) {
        outputLines = result.output.split('\n');
      }
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : String(e);
    } finally {
      running = false;
      unlistenOutput?.();
      unlistenComplete?.();
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (running) return; // Don't close while running
      if (selectedCommand && outputLines.length === 0) {
        goBack();
      } else {
        onclose();
      }
      e.preventDefault();
    }
    if (e.key === 'Enter' && selectedCommand && !running) {
      e.preventDefault();
      runCommand();
    }
  }

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget && !running) {
      onclose();
    }
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="overlay" onclick={handleOverlayClick}>
  <div class="modal" role="dialog" aria-label="Command Runner">
    {#if !selectedCommand}
      <!-- Command list view -->
      <div class="modal-header">
        <input
          bind:this={filterInput}
          bind:value={filter}
          type="text"
          class="filter-input"
          placeholder="Search commands..."
        />
      </div>
      <div class="command-list">
        {#if filteredCommands.length === 0}
          <div class="empty-state">
            {#if commands.length === 0}
              No commands available. Open a workspace first.
            {:else}
              No commands match "{filter}"
            {/if}
          </div>
        {:else}
          {#each filteredCommands as cmd}
            <button class="command-item" onclick={() => selectCommand(cmd)}>
              <div class="command-name">{cmd.name}</div>
              <div class="command-desc">{cmd.description}</div>
              {#if cmd.params.length > 0}
                <div class="command-params">
                  {#each cmd.params as param}
                    <span class="param-badge">{param}</span>
                  {/each}
                </div>
              {/if}
            </button>
          {/each}
        {/if}
      </div>
      <div class="modal-footer">
        <span class="hint">Select a command to run</span>
        <span class="hint">Esc to close</span>
      </div>
    {:else}
      <!-- Command detail / run view -->
      <div class="modal-header detail-header">
        <button class="back-btn" onclick={goBack} disabled={running}>
          &#8592; Back
        </button>
        <span class="detail-title">{selectedCommand.name}</span>
      </div>

      <div class="detail-content">
        <p class="detail-desc">{selectedCommand.description}</p>

        {#if selectedCommand.params.length > 0}
          <div class="params-section">
            <span class="params-label">Parameters</span>
            {#each selectedCommand.params as param}
              <div class="param-field">
                <label class="param-label" for="param-{param}">
                  {param}
                  {#if param === 'date'}
                    <span class="param-optional">(auto-filled if empty)</span>
                  {/if}
                </label>
                <input
                  id="param-{param}"
                  type="text"
                  class="param-input"
                  bind:value={paramValues[param]}
                  placeholder={param === 'date' ? 'YYYY-MM-DD (optional)' : `Enter ${param}...`}
                  disabled={running}
                />
              </div>
            {/each}
          </div>
        {/if}

        {#if errorMessage}
          <div class="error-banner">{errorMessage}</div>
        {/if}

        {#if outputLines.length > 0 || running}
          <div class="output-section">
            <span class="output-label">Output</span>
            <div class="output-container" bind:this={outputContainer}>
              {#each outputLines as line}
                <div class="output-line">{line}</div>
              {/each}
              {#if running}
                <div class="output-line running-indicator">Running...</div>
              {/if}
            </div>
            {#if exitCode !== null}
              <div class="exit-status" class:success={exitCode === 0} class:failure={exitCode !== 0}>
                {exitCode === 0 ? 'Completed successfully' : `Exited with code ${exitCode}`}
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <span class="hint">
          {#if running}
            Command is running...
          {:else}
            Enter to run, Esc to go back
          {/if}
        </span>
        <button
          class="run-btn"
          onclick={runCommand}
          disabled={running}
        >
          {#if running}
            Running...
          {:else}
            Run Command
          {/if}
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 15vh;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(2px);
  }

  .modal {
    width: 560px;
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-secondary, #252525);
    border: 1px solid var(--border-color, #333);
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    overflow: hidden;
  }

  .modal-header {
    padding: 12px;
    border-bottom: 1px solid var(--border-color, #333);
  }

  .filter-input {
    width: 100%;
    padding: 10px 12px;
    font-size: 14px;
    font-family: var(--font-family);
    background: var(--bg-primary, #1e1e1e);
    border: 1px solid var(--border-color, #333);
    border-radius: 4px;
    color: var(--text-primary, #e0e0e0);
    outline: none;
  }

  .filter-input:focus {
    border-color: var(--accent-color, #0078d4);
  }

  .filter-input::placeholder {
    color: var(--text-muted, #666);
  }

  .command-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
  }

  .command-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    padding: 10px 16px;
    text-align: left;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: background 0.1s;
  }

  .command-item:hover {
    background: var(--hover-bg, #333);
  }

  .command-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary, #e0e0e0);
  }

  .command-desc {
    font-size: 12px;
    color: var(--text-muted, #888);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .command-params {
    display: flex;
    gap: 6px;
    margin-top: 2px;
  }

  .param-badge {
    font-size: 11px;
    padding: 1px 6px;
    background: var(--bg-tertiary, #2d2d2d);
    border: 1px solid var(--border-color, #333);
    border-radius: 3px;
    color: var(--accent-color, #0078d4);
    font-family: var(--font-mono);
  }

  .empty-state {
    padding: 24px 16px;
    text-align: center;
    color: var(--text-muted, #666);
    font-size: 13px;
  }

  /* Detail view */
  .detail-header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .back-btn {
    font-size: 13px;
    padding: 4px 8px;
    background: transparent;
    border: 1px solid var(--border-color, #333);
    color: var(--text-muted, #888);
    cursor: pointer;
    border-radius: 3px;
  }

  .back-btn:hover:not(:disabled) {
    background: var(--hover-bg, #333);
    color: var(--text-primary, #fff);
  }

  .detail-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary, #e0e0e0);
  }

  .detail-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .detail-desc {
    font-size: 13px;
    color: var(--text-secondary, #b0b0b0);
    line-height: 1.5;
  }

  .params-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .params-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted, #888);
  }

  .param-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .param-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary, #b0b0b0);
  }

  .param-optional {
    font-weight: 400;
    color: var(--text-muted, #666);
    font-size: 11px;
  }

  .param-input {
    padding: 8px 10px;
    font-size: 13px;
    font-family: var(--font-family);
    background: var(--bg-primary, #1e1e1e);
    border: 1px solid var(--border-color, #333);
    border-radius: 4px;
    color: var(--text-primary, #e0e0e0);
    outline: none;
  }

  .param-input:focus {
    border-color: var(--accent-color, #0078d4);
  }

  .param-input::placeholder {
    color: var(--text-muted, #666);
  }

  .param-input:disabled {
    opacity: 0.6;
  }

  .error-banner {
    padding: 8px 12px;
    font-size: 12px;
    background: rgba(241, 76, 76, 0.1);
    border: 1px solid var(--error-color, #f14c4c);
    border-radius: 4px;
    color: var(--error-color, #f14c4c);
  }

  .output-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .output-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted, #888);
  }

  .output-container {
    max-height: 200px;
    overflow-y: auto;
    padding: 8px 10px;
    background: var(--bg-primary, #1e1e1e);
    border: 1px solid var(--border-color, #333);
    border-radius: 4px;
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.5;
  }

  .output-line {
    color: var(--text-secondary, #b0b0b0);
    white-space: pre-wrap;
    word-break: break-all;
  }

  .running-indicator {
    color: var(--accent-color, #0078d4);
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .exit-status {
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 3px;
  }

  .exit-status.success {
    color: var(--success-color, #4ec9b0);
    background: rgba(78, 201, 176, 0.1);
  }

  .exit-status.failure {
    color: var(--error-color, #f14c4c);
    background: rgba(241, 76, 76, 0.1);
  }

  /* Footer */
  .modal-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 16px;
    border-top: 1px solid var(--border-color, #333);
    background: var(--bg-secondary, #252525);
  }

  .hint {
    font-size: 11px;
    color: var(--text-muted, #666);
  }

  .run-btn {
    padding: 6px 16px;
    font-size: 13px;
    font-weight: 500;
    background: var(--accent-color, #0078d4);
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .run-btn:hover:not(:disabled) {
    background: var(--accent-hover, #1a86dc);
  }

  .run-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
