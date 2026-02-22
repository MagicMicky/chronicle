import { writable, derived, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { currentWorkspace } from './workspace';
import { parseTag, type TagCategory } from '$lib/utils/tagColors';

export interface TagIndex {
  byNote: Record<string, string[]>;
  byTag: Record<string, string[]>;
  categories?: Record<string, TagCategory>;
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

/** Categories from the tag index */
export const tagCategories = derived(tagsStore, ($s) => $s.index.categories ?? {});

/** Sorted list of tags with counts and parsed category info */
export const tagsList = derived(tagsStore, ($s) => {
  const entries = Object.entries($s.index.byTag || {});
  return entries
    .map(([tag, notes]) => {
      const parsed = parseTag(tag);
      return { tag, count: notes.length, category: parsed.category, name: parsed.name };
    })
    .sort((a, b) => b.count - a.count);
});

/** Tags grouped by category */
export const tagsGrouped = derived([tagsList, tagCategories], ([$tags, $cats]) => {
  const groups = new Map<string | null, typeof $tags>();
  for (const t of $tags) {
    const key = t.category;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  // Sort groups: named categories first (alphabetical by label), uncategorized last
  const sorted: { key: string | null; label: string; tags: typeof $tags }[] = [];
  const keys = [...groups.keys()].sort((a, b) => {
    if (a === null) return 1;
    if (b === null) return -1;
    const la = $cats[a]?.label ?? a;
    const lb = $cats[b]?.label ?? b;
    return la.localeCompare(lb);
  });
  for (const key of keys) {
    const label = key ? ($cats[key]?.label ?? key.charAt(0).toUpperCase() + key.slice(1)) : 'Other';
    sorted.push({ key, label, tags: groups.get(key)! });
  }
  return sorted;
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
