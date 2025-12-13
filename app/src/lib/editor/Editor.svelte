<script lang="ts">
  // Editor will wrap CodeMirror in M1
</script>

<div class="editor">
  <div class="pane-header">
    <span class="pane-title">Editor</span>
  </div>
  <div class="pane-content">
    <div class="placeholder">
      <span class="placeholder-icon">&#128221;</span>
      <span class="placeholder-text">Markdown Editor</span>
      <span class="placeholder-hint">Create or open a note to start writing</span>
    </div>
  </div>
</div>

<style>
  .editor {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--editor-bg, #1e1e1e);
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
    font-size: 48px;
    opacity: 0.5;
  }

  .placeholder-text {
    font-size: 16px;
    font-weight: 500;
  }

  .placeholder-hint {
    font-size: 13px;
    opacity: 0.7;
  }
</style>
