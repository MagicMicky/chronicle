<script lang="ts">
  interface Props {
    show: boolean;
  }

  let { show = $bindable(false) }: Props = $props();

  function close() {
    show = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }

  const shortcuts = [
    {
      category: 'Files',
      items: [
        { keys: 'Cmd+N', action: 'New Note' },
        { keys: 'Cmd+T', action: "Today's Note" },
        { keys: 'Cmd+W', action: 'Close Note' },
        { keys: 'Cmd+S', action: 'Save' },
        { keys: 'Cmd+P', action: 'Quick File Jump' },
        { keys: 'Cmd+Shift+F', action: 'Search Notes' },
      ],
    },
    {
      category: 'AI',
      items: [
        { keys: 'Cmd+Enter', action: 'Process Note' },
        { keys: 'Cmd+Shift+P', action: 'Process Note' },
      ],
    },
    {
      category: 'Layout',
      items: [
        { keys: 'Cmd+B / Cmd+\\', action: 'Toggle Sidebar' },
        { keys: 'Cmd+J / Cmd+Shift+A', action: 'Toggle AI Panel' },
        { keys: 'Cmd+`', action: 'Toggle Terminal' },
        { keys: 'Cmd+Shift+F11', action: 'Focus Mode' },
      ],
    },
    {
      category: 'Editor',
      items: [
        { keys: 'Cmd+B', action: 'Bold' },
        { keys: 'Cmd+I', action: 'Italic' },
        { keys: 'Cmd+`', action: 'Code' },
        { keys: 'Cmd+K', action: 'Link' },
      ],
    },
    {
      category: 'Help',
      items: [{ keys: 'Cmd+/', action: 'Show Shortcuts' }],
    },
  ];
</script>

<svelte:window onkeydown={handleKeydown} />

{#if show}
  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events, a11y_interactive_supports_focus -->
  <div class="overlay" onclick={close} onkeydown={(e) => { if (e.key === 'Escape') close(); }} role="dialog" aria-label="Keyboard shortcuts" tabindex="-1">
    <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
    <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
      <div class="modal-header">
        <h2>Keyboard Shortcuts</h2>
        <button class="close-btn" onclick={close} aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">
        {#each shortcuts as group}
          <div class="shortcut-group">
            <h3>{group.category}</h3>
            {#each group.items as shortcut}
              <div class="shortcut-row">
                <kbd>{shortcut.keys}</kbd>
                <span>{shortcut.action}</span>
              </div>
            {/each}
          </div>
        {/each}
      </div>
      <div class="modal-footer">
        <span class="hint">Tip: On Linux/Windows, use Ctrl instead of Cmd</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: var(--bg-secondary, #252525);
    border: 1px solid var(--border-color, #333);
    border-radius: 8px;
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    overflow: auto;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color, #333);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary, #e0e0e0);
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--text-muted, #888);
    font-size: 20px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
    border-radius: 3px;
  }

  .close-btn:hover {
    color: var(--text-primary, #e0e0e0);
    background: var(--hover-bg, #333);
  }

  .modal-body {
    padding: 16px 20px;
  }

  .shortcut-group {
    margin-bottom: 16px;
  }

  .shortcut-group:last-child {
    margin-bottom: 0;
  }

  .shortcut-group h3 {
    margin: 0 0 8px 0;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted, #888);
  }

  .shortcut-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    font-size: 13px;
    color: var(--text-primary, #e0e0e0);
  }

  kbd {
    display: inline-block;
    padding: 2px 8px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: var(--text-primary, #e0e0e0);
    background: var(--bg-tertiary, #2d2d2d);
    border: 1px solid var(--border-color, #333);
    border-radius: 4px;
    box-shadow: 0 1px 0 var(--border-color, #333);
  }

  .modal-footer {
    padding: 12px 20px;
    border-top: 1px solid var(--border-color, #333);
  }

  .hint {
    font-size: 11px;
    color: var(--text-muted, #888);
    opacity: 0.8;
  }
</style>
