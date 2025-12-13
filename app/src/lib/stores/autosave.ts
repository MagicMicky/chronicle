import { writable, derived, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { noteStore, currentNote } from './note';
import { workspaceStore, hasWorkspace } from './workspace';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface AutoSaveState {
  status: SaveStatus;
  lastSaved: Date | null;
  error: string | null;
}

const defaultState: AutoSaveState = {
  status: 'idle',
  lastSaved: null,
  error: null,
};

const DEBOUNCE_MS = 2000;
const SAVED_DISPLAY_MS = 2000;

function createAutoSaveStore() {
  const { subscribe, set, update } = writable<AutoSaveState>(defaultState);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let savedTimer: ReturnType<typeof setTimeout> | null = null;

  const triggerSave = async () => {
    const note = get(currentNote);
    const workspace = get(hasWorkspace);

    if (!note || !note.path || !workspace) {
      return;
    }

    update((s) => ({ ...s, status: 'saving', error: null }));

    try {
      // Write file
      await invoke('write_file', { path: note.path, content: note.content });

      // Check if rename is needed based on H1 heading
      const newPath = await invoke<string | null>('suggest_rename', {
        path: note.path,
        content: note.content,
      });

      if (newPath && newPath !== note.path) {
        // Rename the file
        const finalPath = await invoke<string>('rename_file', {
          oldPath: note.path,
          newPath,
        });
        noteStore.markSaved(finalPath);
        // Refresh the file list to show new name
        workspaceStore.refreshFiles();
      } else {
        noteStore.markSaved();
      }

      update((s) => ({ ...s, status: 'saved', lastSaved: new Date(), error: null }));

      // Reset to idle after display period
      if (savedTimer) clearTimeout(savedTimer);
      savedTimer = setTimeout(() => {
        update((s) => (s.status === 'saved' ? { ...s, status: 'idle' } : s));
      }, SAVED_DISPLAY_MS);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.error('Auto-save failed:', error);
      update((s) => ({ ...s, status: 'error', error }));
    }
  };

  return {
    subscribe,

    // Called on every content change - debounces and triggers save
    onContentChange: () => {
      const note = get(currentNote);
      const workspace = get(hasWorkspace);

      // Only auto-save if we have a workspace and the note has a path
      if (!note || !note.path || !workspace) {
        return;
      }

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(triggerSave, DEBOUNCE_MS);
    },

    // Force immediate save (Cmd+S)
    saveNow: async () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      await triggerSave();
    },

    // Cancel pending save
    cancel: () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    },

    // Reset state
    reset: () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (savedTimer) clearTimeout(savedTimer);
      set(defaultState);
    },
  };
}

export const autoSaveStore = createAutoSaveStore();

// Derived stores
export const saveStatus = derived(autoSaveStore, ($s) => $s.status);
export const lastSaved = derived(autoSaveStore, ($s) => $s.lastSaved);
export const saveError = derived(autoSaveStore, ($s) => $s.error);
