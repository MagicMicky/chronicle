import { writable, derived, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { currentWorkspace } from './workspace';

export interface ActionItem {
  text: string;
  owner: string;
  source: string;
  line: number;
  created: string;
  status: 'open' | 'done' | 'stale';
}

interface ActionsState {
  actions: ActionItem[];
  lastLoaded: Date | null;
  isLoading: boolean;
  error: string | null;
}

const defaultState: ActionsState = {
  actions: [],
  lastLoaded: null,
  isLoading: false,
  error: null,
};

function createActionsStore() {
  const { subscribe, set, update } = writable<ActionsState>(defaultState);

  return {
    subscribe,

    /** Load actions from .chronicle/actions.json via Rust command */
    load: async () => {
      const workspace = get(currentWorkspace);
      if (!workspace) return;

      update((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const raw = await invoke<string>('read_actions_file', {
          workspacePath: workspace.path,
        });
        const parsed: ActionItem[] = JSON.parse(raw);
        update((s) => ({
          ...s,
          actions: parsed,
          lastLoaded: new Date(),
          isLoading: false,
        }));
      } catch (e) {
        // File may not exist yet — that is fine
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('not found') || msg.includes('No such file') || msg.includes('Failed to read')) {
          update((s) => ({ ...s, actions: [], lastLoaded: new Date(), isLoading: false }));
        } else {
          update((s) => ({ ...s, isLoading: false, error: msg }));
        }
      }
    },

    /** Toggle a single action between open and done */
    toggleStatus: async (index: number) => {
      const workspace = get(currentWorkspace);
      if (!workspace) return;

      const state = get({ subscribe });
      const action = state.actions[index];
      if (!action) return;

      const newStatus = action.status === 'done' ? 'open' : 'done';

      try {
        await invoke('update_action_status', {
          workspacePath: workspace.path,
          actionIndex: index,
          newStatus,
        });
        // Optimistic update
        update((s) => ({
          ...s,
          actions: s.actions.map((a, i) => (i === index ? { ...a, status: newStatus } : a)),
        }));
      } catch (e) {
        console.error('Failed to update action status:', e);
      }
    },

    clear: () => set(defaultState),
  };
}

export const actionsStore = createActionsStore();

// Derived stores
export const actionItems = derived(actionsStore, ($s) => $s.actions);
export const actionsLastLoaded = derived(actionsStore, ($s) => $s.lastLoaded);

export const openActions = derived(actionItems, ($items) =>
  $items.filter((a) => a.status === 'open')
);

export const overdueActions = derived(actionItems, ($items) =>
  $items.filter((a) => {
    if (a.status !== 'open') return false;
    const created = new Date(a.created);
    const daysOld = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
    return daysOld > 7;
  })
);

export const doneActions = derived(actionItems, ($items) =>
  $items.filter((a) => a.status === 'done')
);

export const actionSummary = derived(
  [openActions, overdueActions, doneActions],
  ([$open, $overdue, $done]) => ({
    open: $open.length,
    overdue: $overdue.length,
    done: $done.length,
    total: $open.length + $overdue.length + $done.length,
  })
);

/** Alias for ActionItem used in Explorer */
export type ActionEntry = ActionItem;

/** Action counts derived store */
export const actionCounts = derived(
  [openActions, overdueActions, doneActions],
  ([$open, $overdue, $done]) => ({
    open: $open.length,
    overdue: $overdue.length,
    done: $done.length,
  })
);

/** Actions grouped by source note */
export const actionsByNote = derived(actionItems, ($items) => {
  const map = new Map<string, ActionItem[]>();
  for (const item of $items) {
    const key = item.source || 'unknown';
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return map;
});

/** Initialize actions listener for filesystem watch events */
export function initActionsListener(): () => void {
  // Load initially
  actionsStore.load();

  // No additional file watcher needed — actions are loaded on demand
  // Return a no-op cleanup function
  return () => {};
}
