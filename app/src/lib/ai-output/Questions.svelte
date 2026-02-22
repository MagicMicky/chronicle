<script lang="ts">
  import type { Question } from '$lib/stores/aiOutput';

  interface Props {
    questions: Question[];
  }

  let { questions }: Props = $props();

  function scrollToLine(line: number) {
    window.dispatchEvent(
      new CustomEvent('chronicle:scroll-to-line', { detail: { line } })
    );
  }
</script>

{#if questions.length > 0}
  <section class="ai-section questions">
    <h3 class="section-title">Open Questions</h3>
    <ul class="questions-list">
      {#each questions as question}
        <li class="question-item">
          {question.text}
          {#if question.sourceLine}
            <button
              class="source-link"
              onclick={() => scrollToLine(question.sourceLine!)}
              title="Go to line {question.sourceLine}"
            >(L{question.sourceLine})</button>
          {/if}
        </li>
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

  .source-link {
    background: none;
    border: none;
    padding: 0;
    font-size: 11px;
    color: var(--text-muted, #888);
    cursor: pointer;
    text-decoration: none;
    margin-left: 4px;
  }

  .source-link:hover {
    color: var(--accent-color, #0078d4);
    text-decoration: underline;
  }
</style>
