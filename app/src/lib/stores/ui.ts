import { writable } from 'svelte/store';

export interface PaneState {
  explorerWidth: number;
  aiOutputWidth: number;
  terminalHeight: number;
  collapsed: {
    explorer: boolean;
    aiOutput: boolean;
    terminal: boolean;
  };
}

const defaultState: PaneState = {
  explorerWidth: 250,
  aiOutputWidth: 350,
  terminalHeight: 200,
  collapsed: {
    explorer: false,
    aiOutput: false,
    terminal: false,
  },
};

function createUIStore() {
  const { subscribe, set, update } = writable<PaneState>(defaultState);

  return {
    subscribe,
    setExplorerWidth: (width: number) =>
      update((state) => ({ ...state, explorerWidth: Math.max(150, Math.min(500, width)) })),
    setAIOutputWidth: (width: number) =>
      update((state) => ({ ...state, aiOutputWidth: Math.max(200, Math.min(600, width)) })),
    setTerminalHeight: (height: number) =>
      update((state) => ({ ...state, terminalHeight: Math.max(100, Math.min(400, height)) })),
    toggleCollapse: (pane: 'explorer' | 'aiOutput' | 'terminal') =>
      update((state) => ({
        ...state,
        collapsed: { ...state.collapsed, [pane]: !state.collapsed[pane] },
      })),
    reset: () => set(defaultState),
  };
}

export const uiStore = createUIStore();
