<script lang="ts">
  interface Props {
    points: string[];
  }

  let { points }: Props = $props();
</script>

{#if points.length > 0}
  <section class="ai-section key-points">
    <h3 class="section-title">Key Points</h3>
    <ul class="points-list">
      {#each points as point}
        <li class="point-item">{point}</li>
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
</style>
