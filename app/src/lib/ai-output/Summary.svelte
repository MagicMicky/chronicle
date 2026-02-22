<script lang="ts">
  import { Copy } from 'lucide-svelte';
  import { toast } from '$lib/stores/toast';

  interface Props {
    tldr: string | null;
  }

  let { tldr }: Props = $props();

  async function copySection() {
    if (!tldr) return;
    try {
      await navigator.clipboard.writeText(tldr);
      toast.success('Copied!', 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }
</script>

{#if tldr}
  <section class="ai-section summary">
    <div class="section-header-row">
      <h3 class="section-title">TL;DR</h3>
      <button class="copy-btn" onclick={copySection} title="Copy TL;DR" aria-label="Copy TL;DR">
        <Copy size={12} />
      </button>
    </div>
    <p class="summary-text">{tldr}</p>
  </section>
{/if}

<style>
  .summary {
    background: var(--bg-tertiary, #2d2d2d);
  }

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

  .summary:hover .copy-btn {
    opacity: 1;
  }

  .copy-btn:hover {
    background: var(--hover-bg, #333);
    color: var(--text-primary, #fff);
  }

  .summary-text {
    font-size: 14px;
    line-height: 1.6;
    color: var(--text-primary, #e0e0e0);
    margin: 0;
  }
</style>
