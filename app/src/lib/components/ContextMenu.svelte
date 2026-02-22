<script context="module" lang="ts">
  export interface MenuItem {
    label: string;
    action: () => void;
    disabled?: boolean;
    separator?: boolean;
  }
</script>

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  export let items: MenuItem[] = [];
  export let x: number = 0;
  export let y: number = 0;
  export let visible: boolean = false;
  export let onClose: () => void = () => {};

  let menuEl: HTMLDivElement;

  function handleClickOutside(e: MouseEvent) {
    if (visible && menuEl && !menuEl.contains(e.target as Node)) {
      onClose();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (visible && e.key === 'Escape') {
      onClose();
    }
  }

  function handleItemClick(item: MenuItem) {
    if (item.disabled) return;
    item.action();
    onClose();
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside, true);
    document.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    document.removeEventListener('click', handleClickOutside, true);
    document.removeEventListener('keydown', handleKeydown);
  });

  // Adjust position to stay within viewport
  $: if (visible && menuEl) {
    const rect = menuEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (x + rect.width > vw) x = vw - rect.width - 4;
    if (y + rect.height > vh) y = vh - rect.height - 4;
  }
</script>

{#if visible}
  <div
    class="context-menu"
    bind:this={menuEl}
    style="left: {x}px; top: {y}px"
    role="menu"
  >
    {#each items as item}
      {#if item.separator}
        <div class="separator"></div>
      {/if}
      <button
        class="menu-item"
        class:disabled={item.disabled}
        role="menuitem"
        disabled={item.disabled}
        on:click={() => handleItemClick(item)}
      >
        {item.label}
      </button>
    {/each}
  </div>
{/if}

<style>
  .context-menu {
    position: fixed;
    z-index: 1000;
    min-width: 180px;
    max-width: 240px;
    background: var(--pane-bg, #1e1e1e);
    border: 1px solid var(--border-color, #333);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    padding: 4px 0;
    max-height: 300px;
    overflow-y: auto;
  }

  .menu-item {
    display: block;
    width: 100%;
    padding: 6px 12px;
    border: none;
    background: transparent;
    color: var(--text-secondary, #ccc);
    font-size: 13px;
    text-align: left;
    cursor: pointer;
    border-radius: 0;
  }

  .menu-item:hover:not(.disabled) {
    background: var(--hover-bg, #333);
    color: var(--text-primary, #fff);
  }

  .menu-item.disabled {
    opacity: 0.4;
    cursor: default;
  }

  .separator {
    height: 1px;
    background: var(--border-color, #333);
    margin: 4px 0;
  }
</style>
