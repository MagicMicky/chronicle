import { writable, derived, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { currentWorkspace } from './workspace';

export interface TagIndex {
  byNote: Record<string, string[]>;
  byTag: Record<string, string[]>;
}

interface TagsState {
  index: TagIndex;
  selectedTag: string | null;
}

const defaultState: TagsState = {
  index: { byNote: {}, byTag: {} },
  selectedTag: null,
};

function createTagsStore() {
  const { subscribe, set, update } = writable<TagsState>(defaultState);

  return {
    subscribe,

    load: async () => {
      const ws = get(currentWorkspace);
      if (!ws) return;

      try {
        const data = await invoke<TagIndex>('read_tags', { workspacePath: ws.path });
        update((s) => ({
          ...s,
          index: data && data.byTag ? data : { byNote: {}, byTag: {} },
        }));
      } catch {
        // Tags file may not exist yet
      }
    },

    selectTag: (tag: string | null) => {
      update((s) => ({
        ...s,
        selectedTag: s.selectedTag === tag ? null : tag,
      }));
    },

    clear: () => set(defaultState),
  };
}

export const tagsStore = createTagsStore();

/** Sorted list of tags with counts */
export const tagsList = derived(tagsStore, ($s) => {
  const entries = Object.entries($s.index.byTag || {});
  return entries
    .map(([tag, notes]) => ({ tag, count: notes.length }))
    .sort((a, b) => b.count - a.count);
});

export const selectedTag = derived(tagsStore, ($s) => $s.selectedTag);

/** Set of file paths that match the selected tag */
export const tagFilteredPaths = derived(tagsStore, ($s) => {
  if (!$s.selectedTag) return null;
  const paths = $s.index.byTag[$s.selectedTag] ?? [];
  return new Set(paths);
});

/** Initialize event listener for tags updates */
export async function initTagsListener(): Promise<UnlistenFn> {
  return listen('chronicle:tags-updated', () => {
    tagsStore.load();
  });
}
