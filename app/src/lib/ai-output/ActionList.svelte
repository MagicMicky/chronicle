<script lang="ts">
  import type { ActionItem } from '$lib/stores/aiOutput';
  import { Copy } from 'lucide-svelte';
  import { toast } from '$lib/stores/toast';

  interface Props {
    actions: ActionItem[];
  }

  let { actions = $bindable() }: Props = $props();

  function toggleAction(index: number) {
    actions[index].completed = !actions[index].completed;
    actions = actions; // trigger reactivity
  }

  let completedCount = $derived(actions.filter((a) => a.completed).length);

  async function copySection() {
    if (actions.length === 0) return;
    const text = actions
      .map((a) => `- [${a.completed ? 'x' : ' '}] ${a.text}${a.owner ? ` (@${a.owner})` : ''}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied!', 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }
</script>

{#if actions.length > 0}
  <section class="ai-section actions">
    <div class="action-header">
      <h3 class="section-title">Action Items</h3>
      <span class="action-count">{completedCount}/{actions.length}</span>
      <button class="copy-btn" onclick={copySection} title="Copy Action Items" aria-label="Copy Action Items">
        <Copy size={12} />
      </button>
    </div>
    <ul class="action-list">
      {#each actions as action, i}
        <li class="action-item" class:completed={action.completed}>
          <input
            type="checkbox"
            checked={action.completed}
            onchange={() => toggleAction(i)}
            class="action-checkbox"
          />
          <span class="action-text">{action.text}</span>
          {#if action.owner}
            <span class="action-owner">@{action.owner}</span>
          {/if}
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .action-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .action-header .section-title {
    margin-bottom: 0;
  }

  .action-count {
    font-size: 11px;
    color: var(--text-muted, #888);
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
    margin-left: auto;
  }

  .actions:hover .copy-btn {
    opacity: 1;
  }

  .copy-btn:hover {
    background: var(--hover-bg, #333);
    color: var(--text-primary, #fff);
  }

  .action-list {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .action-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 13px;
    line-height: 1.5;
    color: var(--text-primary, #e0e0e0);
    margin-bottom: 8px;
  }

  .action-item:last-child {
    margin-bottom: 0;
  }

  .action-item.completed .action-text {
    text-decoration: line-through;
    opacity: 0.6;
  }

  .action-checkbox {
    margin-top: 3px;
    cursor: pointer;
    accent-color: var(--accent-color, #0078d4);
  }

  .action-text {
    flex: 1;
    transition: opacity 0.15s;
  }

  .action-owner {
    font-size: 11px;
    color: var(--accent-color, #0078d4);
    background: var(--bg-tertiary, #2d2d2d);
    padding: 2px 6px;
    border-radius: 3px;
    white-space: nowrap;
  }
</style>
