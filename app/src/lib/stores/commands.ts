import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface CommandInfo {
  name: string;
  filename: string;
  description: string;
  params: string[];
  content: string;
}

interface CommandsState {
  commands: CommandInfo[];
  loading: boolean;
}

function createCommandsStore() {
  const { subscribe, set, update } = writable<CommandsState>({
    commands: [],
    loading: false,
  });

  return {
    subscribe,
    async load(workspacePath: string) {
      update((s) => ({ ...s, loading: true }));
      try {
        const commands = await invoke<CommandInfo[]>('list_commands', { workspacePath });
        set({ commands, loading: false });
      } catch (e) {
        console.error('Failed to load commands:', e);
        set({ commands: [], loading: false });
      }
    },
    reset() {
      set({ commands: [], loading: false });
    },
  };
}

export const commandsStore = createCommandsStore();
export const availableCommands = derived(commandsStore, ($s) => $s.commands);
export const commandsLoading = derived(commandsStore, ($s) => $s.loading);

// Store for opening the command runner modal (optionally with a pre-selected command)
export const commandRunnerRequest = writable<CommandInfo | null | undefined>(undefined);

/**
 * Request to open the command runner modal.
 * Pass a CommandInfo to pre-select it, or null to just open the list.
 */
export function openCommandRunner(command?: CommandInfo) {
  commandRunnerRequest.set(command ?? null);
}

/**
 * Close the command runner modal.
 */
export function closeCommandRunner() {
  commandRunnerRequest.set(undefined);
}
