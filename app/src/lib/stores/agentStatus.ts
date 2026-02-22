import { writable, derived, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { currentWorkspace } from './workspace';

interface AgentStatusState {
  isRunning: boolean;
  lastRun: Date | null;
}

const defaultState: AgentStatusState = {
  isRunning: false,
  lastRun: null,
};

function createAgentStatusStore() {
  const { subscribe, set, update } = writable<AgentStatusState>(defaultState);

  return {
    subscribe,

    setRunning: (running: boolean) => {
      update((s) => ({
        ...s,
        isRunning: running,
        lastRun: running ? s.lastRun : new Date(),
      }));
    },

    loadStatus: async () => {
      const ws = get(currentWorkspace);
      if (!ws) return;

      try {
        const data = await invoke<Record<string, string>>('get_agent_status', {
          workspacePath: ws.path,
        });
        // Find the most recent run timestamp
        let latest: Date | null = null;
        for (const ts of Object.values(data)) {
          if (typeof ts === 'string') {
            const d = new Date(ts);
            if (!isNaN(d.getTime()) && (!latest || d > latest)) {
              latest = d;
            }
          }
        }
        if (latest) {
          update((s) => ({ ...s, lastRun: latest }));
        }
      } catch {
        // agent-runs.json may not exist yet
      }
    },

    clear: () => set(defaultState),
  };
}

export const agentStatusStore = createAgentStatusStore();

export const isAgentsRunning = derived(agentStatusStore, ($s) => $s.isRunning);
export const lastAgentRun = derived(agentStatusStore, ($s) => $s.lastRun);

/** Initialize event listeners for agent lifecycle */
export async function initAgentListeners(): Promise<UnlistenFn[]> {
  const unlisteners: UnlistenFn[] = [];

  unlisteners.push(
    await listen('claude:agents-started', () => {
      agentStatusStore.setRunning(true);
    })
  );

  unlisteners.push(
    await listen('claude:agents-completed', () => {
      agentStatusStore.setRunning(false);
    })
  );

  return unlisteners;
}
