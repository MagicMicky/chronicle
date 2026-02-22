import { writable, derived } from 'svelte/store';

const STORAGE_KEY = 'chronicle:recent-files';
const MAX_ENTRIES = 10;
const DISPLAY_LIMIT = 5;

interface RecentFile {
  path: string;
  name: string;
  folder: string;
}

function loadFromStorage(): RecentFile[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

function saveToStorage(files: RecentFile[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
  } catch {
    // Ignore storage errors
  }
}

function extractFileInfo(filePath: string): { name: string; folder: string } {
  const parts = filePath.replace(/\\/g, '/').split('/');
  const name = parts[parts.length - 1] || filePath;
  const folder = parts.length > 2 ? parts[parts.length - 2] + '/' : '';
  return { name, folder };
}

function createRecentFilesStore() {
  const { subscribe, set, update } = writable<RecentFile[]>(loadFromStorage());

  return {
    subscribe,

    /** Add a file to the top of the recent list */
    add(filePath: string) {
      update((files) => {
        const filtered = files.filter((f) => f.path !== filePath);
        const { name, folder } = extractFileInfo(filePath);
        const updated = [{ path: filePath, name, folder }, ...filtered].slice(0, MAX_ENTRIES);
        saveToStorage(updated);
        return updated;
      });
    },

    /** Remove entries whose paths no longer exist in the workspace files */
    pruneForWorkspace(existingPaths: Set<string>) {
      update((files) => {
        const pruned = files.filter((f) => existingPaths.has(f.path));
        saveToStorage(pruned);
        return pruned;
      });
    },

    /** Clear all recent files */
    clear() {
      saveToStorage([]);
      set([]);
    },
  };
}

export const recentFilesStore = createRecentFilesStore();

/** The top 5 recent files for display */
export const recentFiles = derived(recentFilesStore, ($store) => $store.slice(0, DISPLAY_LIMIT));
