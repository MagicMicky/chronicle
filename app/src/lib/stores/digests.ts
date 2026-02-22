import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface DigestInfo {
  filename: string;
  title: string;
  path: string;
  modifiedAt: number;
}

interface DigestsState {
  digests: DigestInfo[];
  isGenerating: boolean;
}

function createDigestsStore() {
  const { subscribe, set, update } = writable<DigestsState>({
    digests: [],
    isGenerating: false,
  });

  return {
    subscribe,

    async load(workspacePath: string) {
      try {
        const digests = await invoke<DigestInfo[]>('list_digests', { workspacePath });
        update((s) => ({ ...s, digests }));
      } catch (e) {
        console.error('Failed to load digests:', e);
      }
    },

    async generate(
      workspacePath: string,
      range: string,
      fromDate?: string,
      toDate?: string
    ) {
      update((s) => ({ ...s, isGenerating: true }));
      try {
        await invoke('generate_digest', { workspacePath, range, fromDate, toDate });
        // Reload digest list after generation
        const digests = await invoke<DigestInfo[]>('list_digests', { workspacePath });
        update((s) => ({ ...s, digests, isGenerating: false }));
      } catch (e) {
        console.error('Failed to generate digest:', e);
        update((s) => ({ ...s, isGenerating: false }));
      }
    },

    clear() {
      set({ digests: [], isGenerating: false });
    },
  };
}

export const digestsStore = createDigestsStore();
export const availableDigests = derived(digestsStore, ($s) => $s.digests);
export const isGeneratingDigest = derived(digestsStore, ($s) => $s.isGenerating);
