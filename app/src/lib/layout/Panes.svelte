<script lang="ts">
  import { uiStore } from '$lib/stores/ui';
  import PaneHandle from './PaneHandle.svelte';
  import Explorer from '$lib/explorer/Explorer.svelte';
  import Editor from '$lib/editor/Editor.svelte';
  import AIOutput from '$lib/ai-output/AIOutput.svelte';
  import Terminal from '$lib/terminal/Terminal.svelte';

  let ui = $state($uiStore);

  $effect(() => {
    const unsubscribe = uiStore.subscribe((value) => {
      ui = value;
    });
    return unsubscribe;
  });

  function handleExplorerResize(delta: number) {
    uiStore.setExplorerWidth(ui.explorerWidth + delta);
  }

  function handleAIOutputResize(delta: number) {
    uiStore.setAIOutputWidth(ui.aiOutputWidth - delta);
  }

  function handleTerminalResize(delta: number) {
    uiStore.setTerminalHeight(ui.terminalHeight - delta);
  }
</script>

<div class="panes-container">
  <!-- Explorer (left sidebar) -->
  {#if !ui.collapsed.explorer}
    <div class="pane explorer-pane" style="width: {ui.explorerWidth}px;">
      <Explorer />
    </div>
    <PaneHandle direction="vertical" onDrag={handleExplorerResize} />
  {:else}
    <button
      class="collapsed-pane-btn vertical"
      onclick={() => uiStore.toggleCollapse('explorer')}
      title="Expand Explorer"
    >
      <span class="collapsed-label">Explorer</span>
    </button>
  {/if}

  <!-- Center section (Editor + Terminal) -->
  <div class="pane center-pane">
    <div class="center-content">
      <!-- Editor -->
      <div class="pane editor-pane">
        <Editor />
      </div>

      <!-- Terminal -->
      {#if !ui.collapsed.terminal}
        <PaneHandle direction="horizontal" onDrag={handleTerminalResize} />
        <div class="pane terminal-pane" style="height: {ui.terminalHeight}px;">
          <Terminal />
        </div>
      {:else}
        <button
          class="collapsed-pane-btn horizontal"
          onclick={() => uiStore.toggleCollapse('terminal')}
          title="Expand Terminal"
        >
          <span class="collapsed-label">Terminal</span>
        </button>
      {/if}
    </div>
  </div>

  <!-- AI Output (right sidebar) -->
  {#if !ui.collapsed.aiOutput}
    <PaneHandle direction="vertical" onDrag={handleAIOutputResize} />
    <div class="pane ai-output-pane" style="width: {ui.aiOutputWidth}px;">
      <AIOutput />
    </div>
  {:else}
    <button
      class="collapsed-pane-btn vertical right"
      onclick={() => uiStore.toggleCollapse('aiOutput')}
      title="Expand AI Output"
    >
      <span class="collapsed-label">AI Output</span>
    </button>
  {/if}
</div>

<style>
  .panes-container {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .pane {
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .explorer-pane {
    flex-shrink: 0;
  }

  .center-pane {
    flex: 1;
    min-width: 300px;
  }

  .center-content {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .editor-pane {
    flex: 1;
    min-height: 200px;
  }

  .terminal-pane {
    flex-shrink: 0;
  }

  .ai-output-pane {
    flex-shrink: 0;
  }

  .collapsed-pane-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--header-bg, #252525);
    border: none;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .collapsed-pane-btn:hover {
    background: var(--hover-bg, #333);
  }

  .collapsed-pane-btn.vertical {
    width: 24px;
    writing-mode: vertical-rl;
    text-orientation: mixed;
    border-right: 1px solid var(--border-color, #333);
  }

  .collapsed-pane-btn.vertical.right {
    border-right: none;
    border-left: 1px solid var(--border-color, #333);
  }

  .collapsed-pane-btn.horizontal {
    height: 24px;
    width: 100%;
    border-top: 1px solid var(--border-color, #333);
  }

  .collapsed-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted, #888);
    padding: 8px;
  }
</style>
