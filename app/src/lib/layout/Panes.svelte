<script lang="ts">
  import { uiStore } from '$lib/stores/ui';
  import { hasAIResult, setAIPanelManualOverride } from '$lib/stores/aiOutput';
  import PaneHandle from './PaneHandle.svelte';
  import Explorer from '$lib/explorer/Explorer.svelte';
  import Editor from '$lib/editor/Editor.svelte';
  import AIOutput from '$lib/ai-output/AIOutput.svelte';
  import Terminal from '$lib/terminal/Terminal.svelte';
  import { ChevronUp, Sparkles } from 'lucide-svelte';
  import { onMount } from 'svelte';

  let ui = $state($uiStore);
  let prefersReducedMotion = $state(false);
  let aiHasResult = $state(false);
  let showFocusHint = $state(false);
  let focusHintTimer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    const unsubscribe = uiStore.subscribe((value) => {
      ui = value;
    });
    return unsubscribe;
  });

  $effect(() => {
    const unsubscribe = hasAIResult.subscribe((value) => {
      aiHasResult = value;
    });
    return unsubscribe;
  });

  // Show hint when entering focus mode, fade after 3 seconds
  $effect(() => {
    if (ui.focusMode) {
      showFocusHint = true;
      if (focusHintTimer) clearTimeout(focusHintTimer);
      focusHintTimer = setTimeout(() => {
        showFocusHint = false;
      }, 3000);
    } else {
      showFocusHint = false;
      if (focusHintTimer) clearTimeout(focusHintTimer);
    }
  });

  $effect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion = mq.matches;
    function handler(e: MediaQueryListEvent) {
      prefersReducedMotion = e.matches;
    }
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
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

<div class="panes-container" class:focus-mode={ui.focusMode} class:no-motion={prefersReducedMotion}>
  {#if !ui.focusMode}
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
  {/if}

  <!-- Center section (Editor + Terminal) -->
  <div class="pane center-pane">
    <div class="center-content">
      <!-- Editor -->
      <div class="pane editor-pane">
        <Editor />
      </div>

      {#if !ui.focusMode}
        <!-- Terminal drawer (always mounted to keep PTY alive) -->
        {#if ui.collapsed.terminal}
          <button
            class="terminal-bar"
            onclick={() => uiStore.toggleCollapse('terminal')}
            title="Expand Terminal (Cmd+`)"
          >
            <span class="terminal-bar-label">Terminal</span>
            <ChevronUp size={14} />
          </button>
        {:else}
          <PaneHandle direction="horizontal" onDrag={handleTerminalResize} />
        {/if}
        <div
          class="pane terminal-pane"
          class:no-motion={prefersReducedMotion}
          class:terminal-collapsed={ui.collapsed.terminal}
          style="height: {ui.collapsed.terminal ? 0 : ui.terminalHeight}px;"
        >
          <Terminal />
        </div>
      {/if}
    </div>
  </div>

  {#if !ui.focusMode}
    <!-- AI Output (right sidebar) -->
    {#if !ui.collapsed.aiOutput}
      <PaneHandle direction="vertical" onDrag={handleAIOutputResize} />
      <div
        class="pane ai-output-pane"
        class:no-motion={prefersReducedMotion}
        style="width: {ui.aiOutputWidth}px;"
      >
        <AIOutput />
      </div>
    {:else}
      <button
        class="collapsed-pane-btn vertical right"
        onclick={() => { setAIPanelManualOverride(); uiStore.toggleCollapse('aiOutput'); }}
        title={aiHasResult ? 'AI Output (has results - click to expand)' : 'Expand AI Output'}
      >
        {#if aiHasResult}
          <span class="ai-indicator"><Sparkles size={12} /></span>
        {/if}
        <span class="collapsed-label">AI Output</span>
      </button>
    {/if}
  {/if}

  <!-- Focus mode hint -->
  {#if ui.focusMode && showFocusHint}
    <div class="focus-hint" class:no-motion={prefersReducedMotion}>
      ESC to exit focus mode
    </div>
  {/if}
</div>

<style>
  .panes-container {
    display: flex;
    flex: 1;
    min-height: 0;
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
    min-height: 0;
  }

  .editor-pane {
    flex: 1;
    min-height: 200px;
  }

  .terminal-pane {
    flex-shrink: 0;
    animation: terminal-slide-up 200ms ease-out;
  }

  .terminal-pane.no-motion {
    animation: none;
  }

  .terminal-pane.terminal-collapsed {
    height: 0 !important;
    overflow: hidden;
    animation: none;
  }

  @keyframes terminal-slide-up {
    from {
      height: 0;
      opacity: 0.5;
    }
  }

  .terminal-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 28px;
    width: 100%;
    padding: 0 12px;
    background: var(--header-bg, #252525);
    border: none;
    border-top: 1px solid var(--border-color, #333);
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.15s ease;
  }

  .terminal-bar:hover {
    background: var(--hover-bg, #333);
  }

  .terminal-bar-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted, #888);
  }

  .terminal-bar :global(svg) {
    color: var(--text-muted, #888);
  }

  .ai-output-pane {
    flex-shrink: 0;
    min-width: 250px;
    animation: ai-slide-in 200ms ease-out;
  }

  .ai-output-pane.no-motion {
    animation: none;
  }

  @keyframes ai-slide-in {
    from {
      opacity: 0.5;
    }
  }

  .ai-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-color, #0078d4);
    margin-bottom: 4px;
    animation: indicator-pulse 2s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .ai-indicator {
      animation: none;
    }
  }

  @keyframes indicator-pulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
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

  .collapsed-pane-btn:focus-visible {
    outline: 2px solid var(--accent-color, #0078d4);
    outline-offset: -2px;
  }

  .collapsed-pane-btn.vertical {
    width: 32px;
    writing-mode: vertical-rl;
    text-orientation: mixed;
    border-right: 1px solid var(--border-color, #333);
    flex-shrink: 0;
  }

  .collapsed-pane-btn.vertical.right {
    border-right: none;
    border-left: 1px solid var(--border-color, #333);
  }

  .collapsed-label {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--text-muted, #888);
    padding: 12px 4px;
  }

  /* Focus mode */
  .panes-container.focus-mode .center-pane {
    min-width: 0;
  }

  .focus-hint {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    padding: 6px 16px;
    background: var(--bg-secondary, #252525);
    border: 1px solid var(--border-color, #333);
    border-radius: 6px;
    font-size: 12px;
    color: var(--text-muted, #888);
    pointer-events: none;
    z-index: 100;
    animation: focus-hint-fade 3s ease-in-out forwards;
  }

  .focus-hint.no-motion {
    animation: none;
    opacity: 0.7;
  }

  @keyframes focus-hint-fade {
    0% { opacity: 0; }
    10% { opacity: 0.8; }
    70% { opacity: 0.8; }
    100% { opacity: 0; }
  }
</style>
