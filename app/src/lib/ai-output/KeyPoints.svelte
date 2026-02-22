<script lang="ts">
  import type { KeyPoint } from '$lib/stores/aiOutput';

  interface Props {
    points: KeyPoint[];
  }

  let { points }: Props = $props();

  function scrollToLine(line: number) {
    window.dispatchEvent(
      new CustomEvent('chronicle:scroll-to-line', { detail: { line } })
    );
  }
</script>

{#if points.length > 0}
  <section class="ai-section key-points">
    <h3 class="section-title">Key Points</h3>
    <ul class="points-list">
      {#each points as point}
        <li class="point-item">
          {point.text}
          {#if point.sourceLines && point.sourceLines.length > 0}
            <span class="source-ref">
              ({#each point.sourceLines as line, i}
                <button
                  class="source-link"
                  onclick={() => scrollToLine(line)}
                  title="Go to line {line}"
                >L{line}</button>{#if i < point.sourceLines.length - 1}, {/if}
              {/each})
            </span>
          {/if}
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .points-list {
    margin: 0;
    padding: 0 0 0 20px;
    list-style-type: disc;
  }

  .point-item {
    font-size: 13px;
    line-height: 1.5;
    color: var(--text-primary, #e0e0e0);
    margin-bottom: 6px;
  }

  .point-item:last-child {
    margin-bottom: 0;
  }

  .source-ref {
    font-size: 11px;
    color: var(--text-muted, #888);
    margin-left: 4px;
  }

  .source-link {
    background: none;
    border: none;
    padding: 0;
    font-size: 11px;
    color: var(--text-muted, #888);
    cursor: pointer;
    text-decoration: none;
  }

  .source-link:hover {
    color: var(--accent-color, #0078d4);
    text-decoration: underline;
  }
</style>
