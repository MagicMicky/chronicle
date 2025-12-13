<script lang="ts">
  import { uiStore } from '$lib/stores/ui';

  function handleCollapse() {
    uiStore.toggleCollapse('terminal');
  }
</script>

<div class="terminal">
  <div class="pane-header">
    <span class="pane-title">Terminal</span>
    <button class="collapse-btn" onclick={handleCollapse} title="Collapse Terminal">
      <span class="icon">&#x2212;</span>
    </button>
  </div>
  <div class="pane-content">
    <div class="placeholder">
      <span class="placeholder-icon">&#128187;</span>
      <span class="placeholder-text">Terminal</span>
      <span class="placeholder-hint">Integrated terminal with Claude Code</span>
    </div>
  </div>
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
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: auto;
  }

  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: var(--text-muted, #666);
  }

  .placeholder-icon {
    font-size: 32px;
    opacity: 0.5;
  }

  .placeholder-text {
    font-size: 14px;
    font-weight: 500;
  }

  .placeholder-hint {
    font-size: 12px;
    opacity: 0.7;
  }
</style>
