import { writable, derived, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { currentWorkspace } from './workspace';
import { currentNote, isNoteDirty } from './note';

export type FileStatus = 'clean' | 'unsaved' | 'uncommitted';

interface FileStatusState {
  uncommittedFiles: Set<string>;
  isLoading: boolean;
  error: string | null;
}

const defaultState: FileStatusState = {
  uncommittedFiles: new Set(),
  isLoading: false,
  error: null,
};

function createFileStatusStore() {
  const { subscribe, set, update } = writable<FileStatusState>(defaultState);

  return {
    subscribe,

    // Refresh git status from backend
    refresh: async () => {
      const workspace = get(currentWorkspace);
      if (!workspace) {
        update((s) => ({ ...s, uncommittedFiles: new Set() }));
        return;
      }

      update((s) => ({ ...s, isLoading: true }));
      try {
        const files = await invoke<string[]>('get_git_status', {
          workspacePath: workspace.path,
        });
        update((s) => ({
          ...s,
          uncommittedFiles: new Set(files),
          isLoading: false,
          error: null,
        }));
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        console.error('[FileStatus] Failed to get git status:', error);
        update((s) => ({ ...s, isLoading: false, error }));
      }
    },

    // Reset store
    reset: () => set(defaultState),
  };
}

export const fileStatusStore = createFileStatusStore();

// Derived store: get status for a specific file path
export function getFileStatus(filePath: string): FileStatus {
  const state = get(fileStatusStore);
  const note = get(currentNote);
  const dirty = get(isNoteDirty);

  // Check if this is the current file and it's dirty (unsaved)
  if (note?.path === filePath && dirty) {
    return 'unsaved';
  }

  // Check if file is uncommitted in git
  if (state.uncommittedFiles.has(filePath)) {
    return 'uncommitted';
  }

  return 'clean';
}

// Derived store for reactive status lookup
export const fileStatuses = derived(
  [fileStatusStore, currentNote, isNoteDirty],
  ([$fileStatus, $currentNote, $isDirty]) => {
    return {
      getStatus: (filePath: string): FileStatus => {
        // Check if this is the current file and it's dirty (unsaved)
        if ($currentNote?.path === filePath && $isDirty) {
          return 'unsaved';
        }

        // Check if file is uncommitted in git
        if ($fileStatus.uncommittedFiles.has(filePath)) {
          return 'uncommitted';
        }

        return 'clean';
      },
      uncommittedFiles: $fileStatus.uncommittedFiles,
    };
  }
);
