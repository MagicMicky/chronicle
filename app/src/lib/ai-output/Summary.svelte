<script lang="ts">
  interface Props {
    tldr: string | null;
  }

  let { tldr }: Props = $props();
</script>

{#if tldr}
  <section class="ai-section summary">
    <h3 class="section-title">TL;DR</h3>
    <p class="summary-text">{tldr}</p>
  </section>
{/if}

<style>
  .summary {
    background: var(--bg-tertiary, #2d2d2d);
  }

  .summary-text {
    font-size: 14px;
    line-height: 1.6;
    color: var(--text-primary, #e0e0e0);
    margin: 0;
  }
</style>
