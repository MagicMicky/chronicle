<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { uiStore } from '$lib/stores/ui';
  import { terminalStore } from '$lib/stores/terminal';
  import { currentWorkspace } from '$lib/stores/workspace';
  import { spawnPty, type Pty } from './pty';
  import type { Terminal as XTerm } from '@xterm/xterm';
  import type { FitAddon } from '@xterm/addon-fit';
  import type { WebLinksAddon } from '@xterm/addon-web-links';

  let terminalContainer: HTMLElement;
  let terminal: XTerm | null = null;
  let fitAddon: FitAddon | null = null;
  let webLinksAddon: WebLinksAddon | null = null;
  let pty: Pty | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let initialized = false;

  // Debounce resize to prevent rapid resize calls
  let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
  function debouncedFit() {
    if (resizeTimeout) clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (fitAddon && terminal && pty) {
        fitAddon.fit();
        pty.resize(terminal.cols, terminal.rows);
      }
    }, 100);
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
    });

    // Load addons
    fitAddon = new FitAddonClass();
    webLinksAddon = new WebLinksAddonClass();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    // Open terminal in container
    terminal.open(terminalContainer);

    // Wait a tick for DOM to settle, then fit
    await new Promise((resolve) => requestAnimationFrame(resolve));
    fitAddon.fit();

    // Spawn PTY process
    try {
      console.log('[Terminal] Spawning PTY with cwd:', workspacePath);
      console.log('[Terminal] Terminal size:', terminal.cols, 'x', terminal.rows);

      pty = await spawnPty({
        cols: terminal.cols,
        rows: terminal.rows,
        cwd: workspacePath,
      });

      console.log('[Terminal] PTY spawned successfully');

      // Wire up data flow: PTY -> Terminal
      pty.onData((data: string) => {
        console.log('[Terminal] PTY data received:', data.length, 'bytes');
        terminal?.write(data);
      });

      // Handle PTY exit
      pty.onExit((e) => {
        console.log('[Terminal] PTY exited with code:', e.exitCode, 'signal:', e.signal);
        terminal?.writeln(`\r\n[Process exited with code ${e.exitCode}]`);
      });

      // Wire up data flow: Terminal -> PTY
      terminal.onData((data: string) => {
        console.log('[Terminal] User input:', JSON.stringify(data));
        pty?.write(data);
      });

      terminalStore.setSpawned(workspacePath);
      console.log('[Terminal] Terminal ready');

      // Write a test message to see if terminal display works
      terminal.writeln('Terminal initialized. Waiting for shell...');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[Terminal] Failed to spawn PTY:', error);
      terminalStore.setError(message);
      terminal.writeln(`\r\n\x1b[31mFailed to spawn terminal: ${message}\x1b[0m`);
    }

    // Set up resize observer
    resizeObserver = new ResizeObserver(() => {
      debouncedFit();
    });
    resizeObserver.observe(terminalContainer);
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
  });

  onDestroy(() => {
    unsubWorkspace?.();
    unsubTerminal?.();
    if (resizeTimeout) clearTimeout(resizeTimeout);
    resizeObserver?.disconnect();
    pty?.kill();
    terminal?.dispose();
    terminalStore.reset();
  });
</script>

<div class="terminal">
  <div class="pane-header">
    <span class="pane-title">Terminal</span>
    <button class="collapse-btn" onclick={handleCollapse} title="Collapse Terminal">
      <span class="icon">&#x2212;</span>
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
    padding: 4px;
  }

  /* xterm.js container fills available space */
  .pane-content :global(.xterm) {
    height: 100%;
  }

  .pane-content :global(.xterm-viewport) {
    overflow-y: auto !important;
  }
</style>
