<script lang="ts">
  import '../app.css';
  import { uiStore } from '$lib/stores/ui';
  import { terminalStore } from '$lib/stores/terminal';
  import { get } from 'svelte/store';
  import { onMount } from 'svelte';
  import StatusBar from '$lib/layout/StatusBar.svelte';

  interface Props {
    children: import('svelte').Snippet;
  }

  let { children }: Props = $props();

  onMount(() => {
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
    return () => document.removeEventListener('keydown', handleKeyDown);
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
