<script lang="ts">
  import { toast, type Toast } from '$lib/stores/toast';
  import { CircleCheck, CircleX, TriangleAlert, Info, X } from 'lucide-svelte';

  const iconMap = {
    success: CircleCheck,
    error: CircleX,
    warning: TriangleAlert,
    info: Info,
  } as const;
</script>

<div class="toast-container" role="status" aria-live="polite">
  {#each $toast as t (t.id)}
    <div class="toast toast--{t.type}">
      <svelte:component this={iconMap[t.type]} size={16} class="toast-icon" />
      <span class="toast-message">{t.message}</span>
      <button
        class="toast-close"
        onclick={() => toast.dismiss(t.id)}
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    bottom: 28px; /* above status bar */
    right: 12px;
    z-index: 9999;
    display: flex;
    flex-direction: column-reverse;
    gap: 8px;
    max-width: 350px;
    pointer-events: none;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    pointer-events: auto;
    animation: slide-in 200ms ease-out;
  }

  .toast--success {
    border-left: 3px solid var(--success-color);
  }

  .toast--error {
    border-left: 3px solid var(--error-color);
  }

  .toast--warning {
    border-left: 3px solid var(--warning-color);
  }

  .toast--info {
    border-left: 3px solid var(--accent-color);
  }

  .toast-message {
    flex: 1;
    line-height: 1.4;
  }

  .toast-close {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    color: var(--text-muted);
    transition: color 150ms, background 150ms;
  }

  .toast-close:hover {
    color: var(--text-primary);
    background: var(--hover-bg);
  }

  @keyframes slide-in {
    from {
      opacity: 0;
      transform: translateX(20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .toast {
      animation: none;
    }
  }
</style>
