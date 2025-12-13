import { writable, derived } from 'svelte/store';
import { syncAppState } from './appState';

export interface Note {
  path: string | null;
  content: string;
  title: string;
  isNew: boolean;
}

interface NoteState {
  currentNote: Note | null;
  isDirty: boolean;
  lastSavedContent: string;
}

const defaultState: NoteState = {
  currentNote: null,
  isDirty: false,
  lastSavedContent: '',
};

function createNoteStore() {
  const { subscribe, set, update } = writable<NoteState>(defaultState);

  return {
    subscribe,

    // Create a new empty note
    newNote: () =>
      update((state) => ({
        ...state,
        currentNote: {
          path: null,
          content: '# New Note\n\n',
          title: 'New Note',
          isNew: true,
        },
        isDirty: false,
        lastSavedContent: '# New Note\n\n',
      })),

    // Open an existing note
    openNote: (path: string, content: string) => {
      const title = extractTitle(content);
      update((state) => ({
        ...state,
        currentNote: {
          path,
          content,
          title,
          isNew: false,
        },
        isDirty: false,
        lastSavedContent: content,
      }));
      // Sync file path and content to backend for MCP server
      syncAppState({ filePath: path, fileContent: content });
    },

    // Update note content (called on every edit)
    updateContent: (content: string) =>
      update((state) => {
        if (!state.currentNote) return state;
        const title = extractTitle(content);
        const isDirty = content !== state.lastSavedContent;
        return {
          ...state,
          currentNote: {
            ...state.currentNote,
            content,
            title,
          },
          isDirty,
        };
      }),

    // Mark note as saved
    markSaved: (newPath?: string) =>
      update((state) => {
        if (!state.currentNote) return state;
        const finalPath = newPath ?? state.currentNote.path;
        // Sync updated path and content to backend for MCP server
        if (finalPath) {
          syncAppState({ filePath: finalPath, fileContent: state.currentNote.content });
        }
        return {
          ...state,
          currentNote: {
            ...state.currentNote,
            path: finalPath,
            isNew: false,
          },
          isDirty: false,
          lastSavedContent: state.currentNote.content,
        };
      }),

    // Close the current note
    closeNote: () => set(defaultState),

    // Reset dirty state (e.g., after external save)
    resetDirty: () =>
      update((state) => ({
        ...state,
        isDirty: false,
        lastSavedContent: state.currentNote?.content ?? '',
      })),
  };
}

// Extract title from first H1 heading
function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : 'Untitled';
}

export const noteStore = createNoteStore();

// Derived stores for convenience
export const currentNote = derived(noteStore, ($noteStore) => $noteStore.currentNote);
export const noteContent = derived(noteStore, ($noteStore) => $noteStore.currentNote?.content ?? '');
export const noteTitle = derived(noteStore, ($noteStore) => $noteStore.currentNote?.title ?? '');
export const isNoteDirty = derived(noteStore, ($noteStore) => $noteStore.isDirty);
export const hasOpenNote = derived(noteStore, ($noteStore) => $noteStore.currentNote !== null);
