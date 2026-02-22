<script lang="ts">
  import { Copy } from 'lucide-svelte';
  import { toast } from '$lib/stores/toast';

  interface Props {
    points: string[];
  }

  let { points }: Props = $props();

  async function copySection() {
    if (points.length === 0) return;
    const text = points.map((p) => `- ${p}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied!', 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }
</script>

{#if points.length > 0}
  <section class="ai-section key-points">
    <div class="section-header-row">
      <h3 class="section-title">Key Points</h3>
      <button class="copy-btn" onclick={copySection} title="Copy Key Points" aria-label="Copy Key Points">
        <Copy size={12} />
      </button>
    </div>
    <ul class="points-list">
      {#each points as point}
        <li class="point-item">{point}</li>
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

  .key-points:hover .copy-btn {
    opacity: 1;
  }

  .copy-btn:hover {
    background: var(--hover-bg, #333);
    color: var(--text-primary, #fff);
  }

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
