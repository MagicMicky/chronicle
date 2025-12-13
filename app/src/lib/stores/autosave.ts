import { writable, derived, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { noteStore, currentNote } from './note';
import { workspaceStore, hasWorkspace, currentWorkspace } from './workspace';

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
    const workspace = get(currentWorkspace);

    console.log('[AutoSave] triggerSave called', { notePath: note?.path, isNew: note?.isNew, workspace: workspace?.path });

    if (!note || !workspace) {
      console.log('[AutoSave] Skipping save - no note or no workspace');
      return;
    }

    update((s) => ({ ...s, status: 'saving', error: null }));

    try {
      let savePath = note.path;

      // For new notes, generate a path from the title
      if (!savePath || note.isNew) {
        // Extract title from content to generate filename
        const titleMatch = note.content.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1].trim() : 'untitled';

        // Generate a slug from the title
        const slug = title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          || 'untitled';

        // Create filename with date prefix
        const date = new Date().toISOString().split('T')[0];
        const filename = `${date}-${slug}.md`;
        savePath = `${workspace.path}/${filename}`;

        console.log('[AutoSave] New note - generated path:', savePath);
      }

      // Write file
      await invoke('write_file', { path: savePath, content: note.content });
      console.log('[AutoSave] File written:', savePath);

      // For existing files, check if rename is needed based on H1 heading
      if (note.path && !note.isNew) {
        const newPath = await invoke<string | null>('suggest_rename', {
          path: savePath,
          content: note.content,
        });

        if (newPath && newPath !== savePath) {
          // Rename the file
          const finalPath = await invoke<string>('rename_file', {
            oldPath: savePath,
            newPath,
          });
          savePath = finalPath;
          console.log('[AutoSave] File renamed to:', finalPath);
        }
      }

      noteStore.markSaved(savePath);
      // Refresh the file list to show new/renamed file
      workspaceStore.refreshFiles();

      update((s) => ({ ...s, status: 'saved', lastSaved: new Date(), error: null }));

      // Reset to idle after display period
      if (savedTimer) clearTimeout(savedTimer);
      savedTimer = setTimeout(() => {
        update((s) => (s.status === 'saved' ? { ...s, status: 'idle' } : s));
      }, SAVED_DISPLAY_MS);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.error('[AutoSave] Save failed:', error);
      update((s) => ({ ...s, status: 'error', error }));
    }
  };

  return {
    subscribe,

    // Called on every content change - debounces and triggers save
    onContentChange: () => {
      const note = get(currentNote);
      const workspace = get(hasWorkspace);

      console.log('[AutoSave] onContentChange', { notePath: note?.path, isNew: note?.isNew, hasWorkspace: workspace });

      // Only auto-save if we have a workspace and a note (path not required for new notes)
      if (!note || !workspace) {
        console.log('[AutoSave] Skipping - no note or no workspace');
        return;
      }

      console.log('[AutoSave] Scheduling save in 2s');
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
