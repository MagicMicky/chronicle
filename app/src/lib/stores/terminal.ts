import { writable, get } from 'svelte/store';

interface TerminalState {
  isSpawned: boolean;
  workingDirectory: string | null;
  error: string | null;
  focusRequested: boolean;
}

const defaultState: TerminalState = {
  isSpawned: false,
  workingDirectory: null,
  error: null,
  focusRequested: false,
};

function createTerminalStore() {
  const { subscribe, set, update } = writable<TerminalState>(defaultState);

  return {
    subscribe,
    setSpawned: (cwd: string) =>
      update((s) => ({ ...s, isSpawned: true, workingDirectory: cwd, error: null })),
    setError: (error: string) =>
      update((s) => ({ ...s, error })),
    requestFocus: () =>
      update((s) => ({ ...s, focusRequested: true })),
    clearFocusRequest: () =>
      update((s) => ({ ...s, focusRequested: false })),
    reset: () => set(defaultState),
  };
}

export const terminalStore = createTerminalStore();
