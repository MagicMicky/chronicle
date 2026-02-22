import { writable, derived, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { currentWorkspace } from './workspace';

export interface ActionEntry {
  text: string;
  owner: string;
  source: string;
  line: number;
  created: string;
  status: 'open' | 'done' | 'stale';
}

interface ActionsState {
  items: ActionEntry[];
}

const defaultState: ActionsState = {
  items: [],
};

function createActionsStore() {
  const { subscribe, set, update } = writable<ActionsState>(defaultState);

  return {
    subscribe,

    load: async () => {
      const ws = get(currentWorkspace);
      if (!ws) return;

      try {
        const data = await invoke<ActionEntry[]>('read_actions', { workspacePath: ws.path });
        update((s) => ({
          ...s,
          items: Array.isArray(data) ? data : [],
        }));
      } catch {
        // Actions file may not exist yet
      }
    },

    clear: () => set(defaultState),
  };
}

export const actionsStore = createActionsStore();

export const actionItems = derived(actionsStore, ($s) => $s.items);

export const openActions = derived(actionsStore, ($s) =>
  $s.items.filter((a) => a.status === 'open')
);

export const staleActions = derived(actionsStore, ($s) =>
  $s.items.filter((a) => a.status === 'stale')
);

export const actionCounts = derived(actionsStore, ($s) => {
  let open = 0;
  let done = 0;
  let stale = 0;
  for (const a of $s.items) {
    if (a.status === 'open') open++;
    else if (a.status === 'done') done++;
    else if (a.status === 'stale') stale++;
  }
  return { open, done, stale };
});

/** Actions grouped by source note */
export const actionsByNote = derived(actionsStore, ($s) => {
  const map = new Map<string, ActionEntry[]>();
  for (const item of $s.items) {
    if (item.status === 'done') continue;
    const existing = map.get(item.source) ?? [];
    existing.push(item);
    map.set(item.source, existing);
  }
  return map;
});

/** Initialize event listener for actions updates */
export async function initActionsListener(): Promise<UnlistenFn> {
  return listen('chronicle:actions-updated', () => {
    actionsStore.load();
  });
}
