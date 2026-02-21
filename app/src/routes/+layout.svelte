<script lang="ts">
  import '../app.css';
  import { uiStore } from '$lib/stores/ui';
  import { terminalStore } from '$lib/stores/terminal';
  import { initAIEventListeners, triggerProcessing } from '$lib/stores/aiOutput';
  import { hasOpenNote } from '$lib/stores/note';
  import { get } from 'svelte/store';
  import { onMount } from 'svelte';
  import StatusBar from '$lib/layout/StatusBar.svelte';
  import type { UnlistenFn } from '@tauri-apps/api/event';

  interface Props {
    children: import('svelte').Snippet;
  }

  let { children }: Props = $props();

  onMount(() => {
    let aiUnlisteners: UnlistenFn[] = [];
    let destroyed = false;

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
      // Cmd/Ctrl + Shift + P: Trigger AI Processing
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        if (get(hasOpenNote)) {
          triggerProcessing();
        }
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
