<script lang="ts">
  interface Props {
    direction: 'vertical' | 'horizontal';
    onDrag: (delta: number) => void;
  }

  let { direction, onDrag }: Props = $props();
  let isDragging = $state(false);
  let startPos = $state(0);

  function handleMouseDown(e: MouseEvent) {
    isDragging = true;
    startPos = direction === 'vertical' ? e.clientX : e.clientY;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = direction === 'vertical' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDragging) return;
    const currentPos = direction === 'vertical' ? e.clientX : e.clientY;
    const delta = currentPos - startPos;
    startPos = currentPos;
    onDrag(delta);
  }

  function handleMouseUp() {
    isDragging = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="pane-handle {direction}"
  class:dragging={isDragging}
  onmousedown={handleMouseDown}
  role="separator"
  aria-orientation={direction === 'vertical' ? 'vertical' : 'horizontal'}
  tabindex="0"
></div>

<style>
  .pane-handle {
    background: var(--border-color, #333);
    transition: background 0.15s ease;
    flex-shrink: 0;
  }

  .pane-handle:hover,
  .pane-handle.dragging {
    background: var(--accent-color, #0078d4);
  }

  .pane-handle.vertical {
    width: 4px;
    cursor: col-resize;
  }

  .pane-handle.horizontal {
    height: 4px;
    cursor: row-resize;
  }
</style>
