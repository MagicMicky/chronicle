import { writable } from 'svelte/store';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration: number;
}

const MAX_TOASTS = 5;
const DEFAULT_DURATION = 4000;

function createToastStore() {
  const { subscribe, update } = writable<Toast[]>([]);
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  function add(type: Toast['type'], message: string, duration?: number) {
    const id = crypto.randomUUID();
    const effectiveDuration = duration ?? (type === 'error' ? 0 : DEFAULT_DURATION);
    const toast: Toast = { id, type, message, duration: effectiveDuration };

    update((toasts) => {
      const next = [toast, ...toasts];
      // Auto-dismiss oldest if over limit
      if (next.length > MAX_TOASTS) {
        const removed = next.pop()!;
        clearTimer(removed.id);
      }
      return next;
    });

    if (effectiveDuration > 0) {
      timers.set(
        id,
        setTimeout(() => dismiss(id), effectiveDuration),
      );
    }

    return id;
  }

  function dismiss(id: string) {
    clearTimer(id);
    update((toasts) => toasts.filter((t) => t.id !== id));
  }

  function clearTimer(id: string) {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
  }

  return {
    subscribe,
    success: (message: string, duration?: number) => add('success', message, duration),
    error: (message: string, duration?: number) => add('error', message, duration),
    warning: (message: string, duration?: number) => add('warning', message, duration),
    info: (message: string, duration?: number) => add('info', message, duration),
    dismiss,
  };
}

export const toast = createToastStore();
