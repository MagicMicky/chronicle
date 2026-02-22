<script lang="ts">
  import { Copy } from 'lucide-svelte';
  import { toast } from '$lib/stores/toast';

  interface Props {
    questions: string[];
  }

  let { questions }: Props = $props();

  async function copySection() {
    if (questions.length === 0) return;
    const text = questions.map((q) => `- ${q}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied!', 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }
</script>

{#if questions.length > 0}
  <section class="ai-section questions">
    <div class="section-header-row">
      <h3 class="section-title">Open Questions</h3>
      <button class="copy-btn" onclick={copySection} title="Copy Questions" aria-label="Copy Questions">
        <Copy size={12} />
      </button>
    </div>
    <ul class="questions-list">
      {#each questions as question}
        <li class="question-item">{question}</li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .section-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .section-header-row .section-title {
    margin-bottom: 0;
  }

  .copy-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    background: transparent;
    border: none;
    color: var(--text-muted, #666);
    cursor: pointer;
    border-radius: 3px;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .questions:hover .copy-btn {
    opacity: 1;
  }

  .copy-btn:hover {
    background: var(--hover-bg, #333);
    color: var(--text-primary, #fff);
  }

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
