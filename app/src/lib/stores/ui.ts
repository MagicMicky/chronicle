import { writable } from 'svelte/store';

export interface PaneState {
  explorerWidth: number;
  aiOutputWidth: number;
  terminalHeight: number;
  focusMode: boolean;
  collapsed: {
    explorer: boolean;
    aiOutput: boolean;
    terminal: boolean;
  };
}

const STORAGE_KEY = 'chronicle:ui-state';

const defaultState: PaneState = {
  explorerWidth: 250,
  aiOutputWidth: 350,
  terminalHeight: 300, // ~18 rows at 13px font - comfortable for interactive use
  focusMode: false,
  collapsed: {
    explorer: false,
    aiOutput: true,
    terminal: true,
  },
};

function loadState(): PaneState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        explorerWidth: parsed.explorerWidth ?? defaultState.explorerWidth,
        aiOutputWidth: parsed.aiOutputWidth ?? defaultState.aiOutputWidth,
        terminalHeight: parsed.terminalHeight ?? defaultState.terminalHeight,
        focusMode: parsed.focusMode ?? defaultState.focusMode,
        collapsed: {
          explorer: parsed.collapsed?.explorer ?? defaultState.collapsed.explorer,
          aiOutput: parsed.collapsed?.aiOutput ?? defaultState.collapsed.aiOutput,
          terminal: parsed.collapsed?.terminal ?? defaultState.collapsed.terminal,
        },
      };
    }
  } catch {
    // Ignore parse errors, use defaults
  }
  return defaultState;
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function persistState(state: PaneState) {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage errors
    }
  }, 200);
}

function createUIStore() {
  const initialState = loadState();
  const { subscribe, set, update } = writable<PaneState>(initialState);

  function updateAndPersist(updater: (state: PaneState) => PaneState) {
    update((state) => {
      const next = updater(state);
      persistState(next);
      return next;
    });
  }

  return {
    subscribe,
    setExplorerWidth: (width: number) =>
      updateAndPersist((state) => ({ ...state, explorerWidth: Math.max(150, Math.min(500, width)) })),
    setAIOutputWidth: (width: number) =>
      updateAndPersist((state) => ({ ...state, aiOutputWidth: Math.max(200, Math.min(600, width)) })),
    setTerminalHeight: (height: number) =>
      updateAndPersist((state) => ({ ...state, terminalHeight: Math.max(150, Math.min(500, height)) })),
    toggleCollapse: (pane: 'explorer' | 'aiOutput' | 'terminal') =>
      updateAndPersist((state) => ({
        ...state,
        collapsed: { ...state.collapsed, [pane]: !state.collapsed[pane] },
      })),
    setCollapsed: (pane: 'explorer' | 'aiOutput' | 'terminal', collapsed: boolean) =>
      updateAndPersist((state) => ({
        ...state,
        collapsed: { ...state.collapsed, [pane]: collapsed },
      })),
    toggleFocusMode: () =>
      updateAndPersist((state) => ({ ...state, focusMode: !state.focusMode })),
    setFocusMode: (enabled: boolean) =>
      updateAndPersist((state) => ({ ...state, focusMode: enabled })),
    reset: () => {
      set(defaultState);
      persistState(defaultState);
    },
  };
}

export const uiStore = createUIStore();
