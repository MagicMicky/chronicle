import { writable, derived, get } from 'svelte/store';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

export interface ActionItem {
  text: string;
  owner: string | null;
  completed: boolean;
}

export interface ParsedSections {
  tldr: string | null;
  keyPoints: string[];
  actions: ActionItem[];
  questions: string[];
  rawNotes: string | null;
}

export interface AIResult {
  path: string;
  processedAt: Date;
  summary: string;
  style: string;
  tokens: { input: number; output: number };
  sections: ParsedSections | null;
}

interface AIOutputState {
  result: AIResult | null;
  isProcessing: boolean;
  error: string | null;
  isLoadingSections: boolean;
}

const defaultState: AIOutputState = {
  result: null,
  isProcessing: false,
  error: null,
  isLoadingSections: false,
};

function createAIOutputStore() {
  const { subscribe, set, update } = writable<AIOutputState>(defaultState);

  return {
    subscribe,

    // Set processing state
    setProcessing: (isProcessing: boolean) =>
      update((s) => ({ ...s, isProcessing, error: null })),

    // Set result from processing
    setResult: (result: AIResult) =>
      update((s) => ({ ...s, result, isProcessing: false, error: null })),

    // Set error state
    setError: (error: string) =>
      update((s) => ({ ...s, error, isProcessing: false })),

    // Clear all state
    clear: () => set(defaultState),

    // Handle processingComplete WebSocket push
    handleProcessingComplete: (data: {
      path?: string;
      result?: {
        summary?: string;
        style?: string;
        tokens?: { input_tokens?: number; output_tokens?: number };
      };
    }) => {
      update((s) => ({
        ...s,
        result: {
          path: data.path ?? '',
          processedAt: new Date(),
          summary: data.result?.summary ?? '',
          style: data.result?.style ?? 'standard',
          tokens: {
            input: data.result?.tokens?.input_tokens ?? 0,
            output: data.result?.tokens?.output_tokens ?? 0,
          },
          sections: null, // Will be loaded separately
        },
        isProcessing: false,
        error: null,
      }));
    },

    // Load parsed sections from the processed file
    loadSections: async (fullPath: string) => {
      // Atomically check and set loading flag to prevent duplicate calls
      let alreadyLoading = false;
      update((s) => {
        if (s.isLoadingSections) {
          alreadyLoading = true;
          return s;
        }
        return { ...s, isLoadingSections: true };
      });
      if (alreadyLoading) return;

      try {
        const sections = await invoke<ParsedSections>('read_processed_file', {
          path: fullPath,
        });
        update((s) => ({
          ...s,
          result: s.result ? { ...s.result, sections } : null,
          isLoadingSections: false,
        }));
      } catch (err) {
        console.error('Failed to load sections:', err);
        update((s) => ({ ...s, isLoadingSections: false }));
      }
    },

    // Set sections directly (for testing or alternative sources)
    setSections: (sections: ParsedSections) =>
      update((s) => ({
        ...s,
        result: s.result ? { ...s.result, sections } : null,
      })),
  };
}

export const aiOutputStore = createAIOutputStore();

// Derived stores for convenience
export const aiResult = derived(aiOutputStore, ($s) => $s.result);
export const isAIProcessing = derived(aiOutputStore, ($s) => $s.isProcessing);
export const aiError = derived(aiOutputStore, ($s) => $s.error);
export const hasAIResult = derived(aiOutputStore, ($s) => $s.result !== null);
export const isLoadingSections = derived(
  aiOutputStore,
  ($s) => $s.isLoadingSections
);

// Initialize Tauri event listeners for AI processing events
export async function initAIEventListeners(): Promise<UnlistenFn[]> {
  const unlisteners: UnlistenFn[] = [];

  // Listen for processing complete events
  unlisteners.push(
    await listen<{
      path: string;
      result: {
        summary: string;
        style: string;
        tokens: { input_tokens: number; output_tokens: number };
      };
    }>('ai:processing-complete', (event) => {
      console.log('Received ai:processing-complete event:', event.payload);
      aiOutputStore.handleProcessingComplete(event.payload);
    })
  );

  // Listen for processing error events
  unlisteners.push(
    await listen<{ error: string }>('ai:processing-error', (event) => {
      console.log('Received ai:processing-error event:', event.payload);
      aiOutputStore.setError(event.payload.error);
    })
  );

  console.log('AI event listeners initialized');
  return unlisteners;
}
