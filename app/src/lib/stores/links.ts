import { writable, derived, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { currentWorkspace } from './workspace';
import { currentNote } from './note';

export interface LinksIndex {
  [notePath: string]: string[];
}

interface LinksState {
  index: LinksIndex;
}

const defaultState: LinksState = {
  index: {},
};

function createLinksStore() {
  const { subscribe, set, update } = writable<LinksState>(defaultState);

  return {
    subscribe,

    load: async () => {
      const ws = get(currentWorkspace);
      if (!ws) return;

      try {
        const data = await invoke<LinksIndex>('read_links', { workspacePath: ws.path });
        update((s) => ({
          ...s,
          index: data && typeof data === 'object' ? data : {},
        }));
      } catch {
        // Links file may not exist yet
      }
    },

    clear: () => set(defaultState),
  };
}

export const linksStore = createLinksStore();

/** Related notes for the currently open file */
export const relatedNotes = derived(
  [linksStore, currentNote],
  ([$links, $note]) => {
    if (!$note?.path) return [];
    // Try relative path (strip workspace prefix is done at read time)
    const related = $links.index[$note.path] ?? [];
    // Also check with just the filename
    if (related.length === 0) {
      const filename = $note.path.split('/').pop() ?? '';
      return $links.index[filename] ?? [];
    }
    return related;
  }
);

/** Initialize event listener for links updates */
export async function initLinksListener(): Promise<UnlistenFn> {
  return listen('chronicle:links-updated', () => {
    linksStore.load();
  });
}
