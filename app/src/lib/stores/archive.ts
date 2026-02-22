import { writable, derived } from 'svelte/store';
import { getInvoke } from '$lib/utils/tauri';

export interface ProcessedNoteInfo {
  notePath: string;
  noteName: string;
  processedPath: string;
  tldr: string | null;
  tags: string[];
  actionCount: number;
  questionCount: number;
  processedAt: string | null;
}

interface ArchiveState {
  notes: ProcessedNoteInfo[];
  loading: boolean;
  filterTag: string | null;
  filterText: string;
}

function createArchiveStore() {
  const { subscribe, update } = writable<ArchiveState>({
    notes: [],
    loading: false,
    filterTag: null,
    filterText: '',
  });

  return {
    subscribe,
    async load(workspacePath: string) {
      update((s) => ({ ...s, loading: true }));
      try {
        const invoke = await getInvoke();
        const notes = await invoke<ProcessedNoteInfo[]>('list_processed_notes', {
          workspacePath,
        });
        update((s) => ({ ...s, notes, loading: false }));
      } catch (e) {
        console.error('Failed to load archive:', e);
        update((s) => ({ ...s, loading: false }));
      }
    },
    setFilterTag(tag: string | null) {
      update((s) => ({ ...s, filterTag: tag }));
    },
    setFilterText(text: string) {
      update((s) => ({ ...s, filterText: text }));
    },
    reset() {
      update(() => ({
        notes: [],
        loading: false,
        filterTag: null,
        filterText: '',
      }));
    },
  };
}

export const archiveStore = createArchiveStore();

export const filteredArchive = derived(archiveStore, ($s) => {
  let notes = $s.notes;

  if ($s.filterTag) {
    const tag = $s.filterTag;
    notes = notes.filter((n) => n.tags.includes(tag));
  }

  if ($s.filterText) {
    const lower = $s.filterText.toLowerCase();
    notes = notes.filter(
      (n) =>
        n.noteName.toLowerCase().includes(lower) ||
        (n.tldr && n.tldr.toLowerCase().includes(lower))
    );
  }

  return notes;
});

export const archiveNoteCount = derived(archiveStore, ($s) => $s.notes.length);

export const allTags = derived(archiveStore, ($s) => {
  const tagSet = new Set<string>();
  for (const note of $s.notes) {
    for (const tag of note.tags) {
      tagSet.add(tag);
    }
  }
  return Array.from(tagSet).sort();
});
