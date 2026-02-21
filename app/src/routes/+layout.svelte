<script lang="ts">
  import '../app.css';
  import { uiStore } from '$lib/stores/ui';
  import { terminalStore } from '$lib/stores/terminal';
  import { initAIEventListeners, triggerProcessing } from '$lib/stores/aiOutput';
  import { hasOpenNote } from '$lib/stores/note';
  import { get } from 'svelte/store';
  import { onMount } from 'svelte';
  import StatusBar from '$lib/layout/StatusBar.svelte';
  import ShortcutGuide from '$lib/components/ShortcutGuide.svelte';
  import QuickOpen from '$lib/components/QuickOpen.svelte';
  import type { UnlistenFn } from '@tauri-apps/api/event';

  interface Props {
    children: import('svelte').Snippet;
  }

  let { children }: Props = $props();
  let showShortcuts = $state(false);
  let showQuickOpen = $state(false);

  onMount(() => {
    let aiUnlisteners: UnlistenFn[] = [];
    let destroyed = false;

    // Theme initialization: check saved preference, then system preference
    const savedTheme = localStorage.getItem('chronicle-theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      document.documentElement.setAttribute('data-theme', 'light');
    }

    // Listen for system theme changes when no explicit preference is saved
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    function handleSystemThemeChange(e: MediaQueryListEvent) {
      if (!localStorage.getItem('chronicle-theme')) {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      }
    }
    mediaQuery.addEventListener('change', handleSystemThemeChange);

    // Initialize AI event listeners
    initAIEventListeners().then((unlisteners) => {
      if (destroyed) {
        // Component unmounted before listeners were ready — clean up immediately
        unlisteners.forEach((fn) => fn());
      } else {
        aiUnlisteners = unlisteners;
      }
    });

    function handleKeyDown(e: KeyboardEvent) {
      // Cmd/Ctrl + B: Toggle Explorer
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        uiStore.toggleCollapse('explorer');
      }
      // Cmd/Ctrl + Shift + A: Toggle AI Output
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        uiStore.toggleCollapse('aiOutput');
      }
      // Cmd/Ctrl + P: Quick file jump
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'p') {
        e.preventDefault();
        showQuickOpen = !showQuickOpen;
      }
      // Cmd/Ctrl + Shift + P: Trigger AI Processing
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        if (get(hasOpenNote)) {
          triggerProcessing();
        }
      }
      // Cmd/Ctrl + /: Toggle shortcut guide
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        showShortcuts = !showShortcuts;
      }
      // Cmd/Ctrl + `: Focus Terminal (expand if collapsed)
      if ((e.metaKey || e.ctrlKey) && e.key === '`') {
        e.preventDefault();
        const ui = get(uiStore);
        if (ui.collapsed.terminal) {
          uiStore.toggleCollapse('terminal');
        }
        // Request focus after a tick (allows terminal to render if just expanded)
        requestAnimationFrame(() => {
          terminalStore.requestFocus();
        });
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      destroyed = true;
      document.removeEventListener('keydown', handleKeyDown);
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
      aiUnlisteners.forEach((fn) => fn());
    };
  });
</script>

<div class="app-container">
  <div class="app-content">
    {@render children()}
  </div>
  <StatusBar />
</div>

<ShortcutGuide bind:show={showShortcuts} />
<QuickOpen bind:show={showQuickOpen} />

<style>
  .app-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  .app-content {
    flex: 1;
    display: flex;
    min-height: 0;
    overflow: hidden;
  }
</style>
