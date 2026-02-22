import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { uiStore } from '$lib/stores/ui';

// Claude CLI availability status (replaces old WebSocket MCP connection status)
export const isMcpConnected = writable<boolean>(false);

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

// Track whether user manually toggled the AI panel (overrides auto behavior until next file switch)
let manualOverride = false;

/** Auto-expand the AI panel (unless user manually overrode) */
function autoExpandAIPanel() {
  if (!manualOverride) {
    uiStore.setCollapsed('aiOutput', false);
  }
}

/** Reset manual override (called on file switch) */
export function resetAIPanelOverride() {
  manualOverride = false;
}

/** Set manual override (called when user manually toggles) */
export function setAIPanelManualOverride() {
  manualOverride = true;
}

function createAIOutputStore() {
  const { subscribe, set, update } = writable<AIOutputState>(defaultState);

  return {
    subscribe,

    // Set processing state
    setProcessing: (isProcessing: boolean) => {
      if (isProcessing) {
        // Processing triggered: force-expand regardless of manual override
        manualOverride = false;
        autoExpandAIPanel();
      }
      update((s) => ({ ...s, isProcessing, error: null }));
    },

    // Set result from processing
    setResult: (result: AIResult) => {
      autoExpandAIPanel();
      update((s) => ({ ...s, result, isProcessing: false, error: null }));
    },

    // Set error state
    setError: (error: string) =>
      update((s) => ({ ...s, error, isProcessing: false })),

    // Clear all state
    clear: () => set(defaultState),

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
export const hasProcessedContent = derived(
  aiOutputStore,
  ($s) => $s.result !== null && $s.result.sections !== null
);
export const isLoadingSections = derived(
  aiOutputStore,
  ($s) => $s.isLoadingSections
);

// Check Claude CLI availability on startup
export async function checkClaudeAvailability(): Promise<void> {
  try {
    const available = await invoke<boolean>('get_mcp_status');
    isMcpConnected.set(available);
  } catch {
    isMcpConnected.set(false);
  }
}
