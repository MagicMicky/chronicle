<script lang="ts">
  import type { ActionItem } from '$lib/stores/aiOutput';

  interface Props {
    actions: ActionItem[];
  }

  let { actions }: Props = $props();
</script>

{#if actions.length > 0}
  <section class="ai-section actions">
    <h3 class="section-title">Action Items</h3>
    <ul class="action-list">
      {#each actions as action}
        <li class="action-item" class:completed={action.completed}>
          <input
            type="checkbox"
            checked={action.completed}
            disabled
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
    color: var(--text-muted, #888);
  }

  .action-checkbox {
    margin-top: 3px;
    cursor: not-allowed;
    accent-color: var(--accent-color, #0078d4);
  }

  .action-text {
    flex: 1;
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
