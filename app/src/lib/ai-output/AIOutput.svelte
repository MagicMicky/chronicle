<script lang="ts">
  import { uiStore } from '$lib/stores/ui';

  function handleCollapse() {
    uiStore.toggleCollapse('aiOutput');
  }
</script>

<div class="ai-output">
  <div class="pane-header">
    <span class="pane-title">AI Output</span>
    <button class="collapse-btn" onclick={handleCollapse} title="Collapse AI Output">
      <span class="icon">&#x2212;</span>
    </button>
  </div>
  <div class="pane-content">
    <div class="placeholder">
      <span class="placeholder-icon">&#129302;</span>
      <span class="placeholder-text">AI Output</span>
      <span class="placeholder-hint">Process a note to see AI-generated summary</span>
    </div>
  </div>
</div>

<style>
  .ai-output {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--pane-bg, #1e1e1e);
  }

  .pane-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--header-bg, #252525);
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
