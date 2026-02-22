<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { uiStore } from '$lib/stores/ui';
  import { terminalStore } from '$lib/stores/terminal';
  import { currentWorkspace } from '$lib/stores/workspace';
  import { claudeInstalled } from '$lib/stores/claudeStatus';
  import { spawnPty, type Pty } from './pty';
  import { Minus } from 'lucide-svelte';
  import type { Terminal as XTerm } from '@xterm/xterm';
  import type { FitAddon } from '@xterm/addon-fit';
  import type { WebLinksAddon } from '@xterm/addon-web-links';

  let terminalContainer: HTMLElement;
  let terminal: XTerm | null = null;
  let fitAddon: FitAddon | null = null;
  let webLinksAddon: WebLinksAddon | null = null;
  let pty: Pty | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let autoLaunchTimeout: ReturnType<typeof setTimeout> | null = null;
  let initialized = false;

  // Track dimensions to avoid unnecessary resizes
  let lastCols = 0;
  let lastRows = 0;

  // Debounce resize with requestAnimationFrame for smooth rendering
  let resizeScheduled = false;

  function debouncedFit() {
    if (resizeScheduled) return;
    resizeScheduled = true;

    // Use rAF to sync with browser render cycle - more responsive than setTimeout
    requestAnimationFrame(() => {
      resizeScheduled = false;
      if (!terminal || !fitAddon) return;
      fitTerminal();
    });
  }

  function fitTerminal() {
    if (!fitAddon || !terminal || !pty) return;

    // Get proposed dimensions WITHOUT applying them yet
    const dims = fitAddon.proposeDimensions();
    if (!dims) return;

    // Only resize if dimensions actually changed
    if (dims.cols === lastCols && dims.rows === lastRows) return;

    // Preserve scroll position
    const scrollTop = terminal.buffer.active.viewportY;
    const wasAtBottom = scrollTop >= terminal.buffer.active.baseY;

    // Resize both PTY and xterm atomically (same frame)
    pty.resize(dims.cols, dims.rows);
    terminal.resize(dims.cols, dims.rows);

    // Restore scroll position (or stay at bottom if we were there)
    if (wasAtBottom) {
      terminal.scrollToBottom();
    }

    // Update tracking
    lastCols = dims.cols;
    lastRows = dims.rows;
  }

  async function initTerminal(workspacePath: string) {
    if (initialized || !terminalContainer) return;
    initialized = true;

    // Dynamic imports to avoid SSR issues
    const { Terminal } = await import('@xterm/xterm');
    const { FitAddon: FitAddonClass } = await import('@xterm/addon-fit');
    const { WebLinksAddon: WebLinksAddonClass } = await import('@xterm/addon-web-links');

    // Import xterm CSS
    await import('@xterm/xterm/css/xterm.css');

    // Create terminal with dark theme
    terminal = new Terminal({
      theme: {
        background: '#0d0d0d',
        foreground: '#e0e0e0',
        cursor: '#e0e0e0',
        cursorAccent: '#0d0d0d',
        selectionBackground: '#44475a',
        black: '#21222c',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#bd93f9',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#f8f8f2',
      },
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      fontSize: 13,
      cursorBlink: true,
      scrollback: 10000,
      allowProposedApi: true,
      scrollOnUserInput: true,
    });

    // Load addons
    fitAddon = new FitAddonClass();
    webLinksAddon = new WebLinksAddonClass();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    // Open terminal in container
    terminal.open(terminalContainer);

    // Wait for DOM to fully settle before fitting
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    fitAddon.fit();

    // Use actual calculated dimensions
    const cols = terminal.cols;
    const rows = terminal.rows;

    // Spawn PTY process
    try {
      pty = await spawnPty({
        cols,
        rows,
        cwd: workspacePath,
      });

      // Wire up data flow: PTY -> Terminal
      pty.onData((data: string) => {
        terminal?.write(data);
        // Auto-expand terminal when output arrives while collapsed
        const ui = get(uiStore);
        if (ui.collapsed.terminal) {
          uiStore.setCollapsed('terminal', false);
        }
      });

      // Handle PTY exit
      pty.onExit((e) => {
        terminal?.writeln(`\r\n[Process exited with code ${e.exitCode}]`);
      });

      // Wire up data flow: Terminal -> PTY
      terminal.onData((data: string) => {
        pty?.write(data);
      });

      terminalStore.setSpawned(workspacePath);

      // Auto-launch Claude Code after shell is ready (only if installed)
      autoLaunchTimeout = setTimeout(() => {
        autoLaunchTimeout = null;
        if (get(claudeInstalled)) {
          pty?.write('claude\n');
        }
      }, 500);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[Terminal] Failed to spawn PTY:', error);
      terminalStore.setError(message);
      terminal.writeln(`\r\n\x1b[31mFailed to spawn terminal: ${message}\x1b[0m`);
    }

    // Store initial dimensions
    lastCols = cols;
    lastRows = rows;

    // Use ResizeObserver for container size changes (best practice)
    resizeObserver = new ResizeObserver(() => {
      debouncedFit();
    });
    resizeObserver.observe(terminalContainer);

    // Also listen for window resize as fallback
    window.addEventListener('resize', debouncedFit);
  }

  function handleCollapse() {
    uiStore.toggleCollapse('terminal');
  }

  /**
   * Focus the terminal. Called by keyboard shortcut.
   */
  export function focus() {
    terminal?.focus();
  }

  // Track workspace changes and focus requests
  let unsubWorkspace: (() => void) | null = null;
  let unsubTerminal: (() => void) | null = null;

  onMount(() => {
    unsubWorkspace = currentWorkspace.subscribe((workspace) => {
      if (workspace && !initialized) {
        initTerminal(workspace.path);
      }
    });

    // Watch for focus requests
    unsubTerminal = terminalStore.subscribe((state) => {
      if (state.focusRequested && terminal) {
        terminal.focus();
        terminalStore.clearFocusRequest();
      }
    });
    // Note: ResizeObserver handles pane size changes, no need for uiStore subscription
  });

  onDestroy(() => {
    unsubWorkspace?.();
    unsubTerminal?.();
    if (autoLaunchTimeout) clearTimeout(autoLaunchTimeout);
    resizeObserver?.disconnect();
    window.removeEventListener('resize', debouncedFit);
    pty?.kill();
    terminal?.dispose();
    terminalStore.reset();
  });
</script>

<div class="terminal">
  <div class="pane-header">
    <span class="pane-title">Terminal</span>
    <button class="collapse-btn" onclick={handleCollapse} title="Collapse Terminal" aria-label="Collapse Terminal">
      <Minus size={14} />
    </button>
  </div>
  <div class="pane-content" bind:this={terminalContainer}></div>
</div>

<style>
  .terminal {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--terminal-bg, #0d0d0d);
  }

  .pane-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--header-bg, #1a1a1a);
    border-bottom: 1px solid var(--border-color, #333);
    flex-shrink: 0;
  }

  .pane-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted, #888);
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
    overflow: hidden;
    /* No padding - let xterm.js handle spacing to avoid dimension calculation issues */
  }

  /* xterm.js container fills available space */
  .pane-content :global(.xterm) {
    height: 100%;
  }

  .pane-content :global(.xterm-viewport) {
    overflow-y: auto !important;
  }
</style>
