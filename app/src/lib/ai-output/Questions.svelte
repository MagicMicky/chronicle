<script lang="ts">
  interface Props {
    questions: string[];
  }

  let { questions }: Props = $props();
</script>

{#if questions.length > 0}
  <section class="ai-section questions">
    <h3 class="section-title">Open Questions</h3>
    <ul class="questions-list">
      {#each questions as question}
        <li class="question-item">{question}</li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .questions-list {
    margin: 0;
    padding: 0 0 0 20px;
    list-style-type: disc;
  }

  .question-item {
    font-size: 13px;
    line-height: 1.5;
    color: var(--warning-color, #cca700);
    margin-bottom: 6px;
  }

  .question-item:last-child {
    margin-bottom: 0;
  }
</style>
