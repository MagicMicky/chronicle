import { writable, derived, get } from 'svelte/store';
import { currentWorkspace } from './workspace';
import { isTauri, getInvoke } from '$lib/utils/tauri';

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
      if (!ws || !isTauri()) return;

      try {
        const invoke = await getInvoke();
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
export async function initAgentListeners(): Promise<(() => void)[]> {
  if (!isTauri()) return [];

  const { listen } = await import('@tauri-apps/api/event');
  const unlisteners: (() => void)[] = [];

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
