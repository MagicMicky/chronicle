<script lang="ts">
  import type { ActionItem } from '$lib/stores/aiOutput';

  interface Props {
    actions: ActionItem[];
  }

  let { actions = $bindable() }: Props = $props();

  function toggleAction(index: number) {
    actions[index].completed = !actions[index].completed;
    actions = actions; // trigger reactivity
  }

  let completedCount = $derived(actions.filter((a) => a.completed).length);
</script>

{#if actions.length > 0}
  <section class="ai-section actions">
    <div class="action-header">
      <h3 class="section-title">Action Items</h3>
      <span class="action-count">{completedCount}/{actions.length}</span>
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
