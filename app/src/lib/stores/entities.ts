import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface Person {
  name: string;
  role?: string;
  markers?: string[];
  source: string;
}

export interface Decision {
  text: string;
  participants?: string[];
  source: string;
}

export interface EntitiesState {
  people: Person[];
  decisions: Decision[];
  topics: string[];
  loading: boolean;
}

function createEntitiesStore() {
  const { subscribe, set, update } = writable<EntitiesState>({
    people: [],
    decisions: [],
    topics: [],
    loading: false,
  });

  return {
    subscribe,
    async loadAll(workspacePath: string) {
      update((s) => ({ ...s, loading: true }));
      try {
        const result = await invoke<{
          people: Person[];
          decisions: Decision[];
          topics: string[];
          references: { ref: string; source: string }[];
        }>('list_all_entities', { workspacePath });
        set({
          people: result.people || [],
          decisions: result.decisions || [],
          topics: result.topics || [],
          loading: false,
        });
      } catch (e) {
        console.error('Failed to load entities:', e);
        update((s) => ({ ...s, loading: false }));
      }
    },
  };
}

export const entitiesStore = createEntitiesStore();

export const knownPeople = derived(entitiesStore, ($s) => {
  // Deduplicate people by name
  const byName = new Map<string, Person>();
  for (const p of $s.people) {
    const key = p.name.toLowerCase();
    if (!byName.has(key)) {
      byName.set(key, p);
    }
  }
  return [...byName.values()];
});

export const knownDecisions = derived(entitiesStore, ($s) => $s.decisions);

export const knownTopics = derived(entitiesStore, ($s) => $s.topics);
