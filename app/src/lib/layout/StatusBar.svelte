<script lang="ts">
  // Status bar will show session info, save status, etc.
  // For now, just a placeholder
</script>

<div class="status-bar">
  <div class="status-left">
    <span class="status-item">Chronicle</span>
  </div>
  <div class="status-center">
    <span class="status-item">Ready</span>
  </div>
  <div class="status-right">
    <span class="status-item">v0.1.0</span>
  </div>
</div>

<style>
  .status-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 24px;
    background: var(--status-bg, #1a1a1a);
    border-top: 1px solid var(--border-color, #333);
    padding: 0 12px;
    font-size: 12px;
    color: var(--text-muted, #888);
  }

  .status-left,
  .status-center,
  .status-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }
</style>
