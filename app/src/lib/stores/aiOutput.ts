import { writable, derived } from 'svelte/store';

export interface AIResult {
  path: string;
  processedAt: Date;
  summary: string;
  style: string;
  tokens: { input: number; output: number };
}

interface AIOutputState {
  result: AIResult | null;
  isProcessing: boolean;
  error: string | null;
}

const defaultState: AIOutputState = {
  result: null,
  isProcessing: false,
  error: null,
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
      path: string;
      result: {
        summary: string;
        style: string;
        tokens: { input_tokens: number; output_tokens: number };
      };
    }) => {
      update((s) => ({
        ...s,
        result: {
          path: data.path,
          processedAt: new Date(),
          summary: data.result.summary,
          style: data.result.style,
          tokens: {
            input: data.result.tokens.input_tokens,
            output: data.result.tokens.output_tokens,
          },
        },
        isProcessing: false,
        error: null,
      }));
    },
  };
}

export const aiOutputStore = createAIOutputStore();

// Derived stores for convenience
export const aiResult = derived(aiOutputStore, ($s) => $s.result);
export const isAIProcessing = derived(aiOutputStore, ($s) => $s.isProcessing);
export const aiError = derived(aiOutputStore, ($s) => $s.error);
export const hasAIResult = derived(aiOutputStore, ($s) => $s.result !== null);
