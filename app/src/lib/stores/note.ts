import { writable, derived, get } from 'svelte/store';
import { syncAppState } from './appState';
import { getInvoke } from '$lib/utils/tauri';

const SESSION_KEY = 'chronicle:last-session';

export interface LastSession {
  workspacePath: string;
  filePath: string;
}

export function saveLastSession(workspacePath: string, filePath: string) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ workspacePath, filePath }));
  } catch {
    // Ignore storage errors
  }
}

export function loadLastSession(): LastSession | null {
  try {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.workspacePath && parsed.filePath) {
        return parsed as LastSession;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

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

/**
 * Open or create today's daily note.
 * Filename: YYYY-MM-DD-dayname.md (e.g. 2026-02-22-sunday.md)
 * Returns the file path on success, or null if no workspace is open.
 */
export async function openDailyNote(workspacePath: string): Promise<string | null> {
  const now = new Date();
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const filename = `${yyyy}-${mm}-${dd}-${dayName}.md`;
  const fullPath = `${workspacePath}/${filename}`;

  const invoke = await getInvoke();
  const exists = await invoke<boolean>('file_exists', { path: fullPath });

  if (exists) {
    const content = await invoke<string>('read_file', { path: fullPath });
    noteStore.openNote(fullPath, content);
  } else {
    const dateHeader = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const template = `# ${dateHeader}\n\n## Notes\n\n\n## Action Items\n\n`;
    await invoke('write_file', { path: fullPath, content: template });
    noteStore.openNote(fullPath, template);
  }

  return fullPath;
}
