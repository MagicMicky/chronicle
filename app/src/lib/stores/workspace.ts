import { writable, derived, get } from 'svelte/store';
import { getInvoke } from '$lib/utils/tauri';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  modifiedAt?: string;
}

export interface Workspace {
  path: string;
  name: string;
  lastOpened: string;
}

export interface WorkspaceInfo {
  path: string;
  name: string;
  isGitRepo: boolean;
  fileCount: number;
}

interface WorkspaceState {
  currentWorkspace: WorkspaceInfo | null;
  files: FileNode[];
  recentWorkspaces: Workspace[];
  isLoading: boolean;
  error: string | null;
}

const defaultState: WorkspaceState = {
  currentWorkspace: null,
  files: [],
  recentWorkspaces: [],
  isLoading: false,
  error: null,
};

function createWorkspaceStore() {
  const { subscribe, set, update } = writable<WorkspaceState>(defaultState);

  return {
    subscribe,

    openWorkspace: async (path: string) => {
      update((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const invoke = await getInvoke();
        const info = await invoke<WorkspaceInfo>('open_workspace', { path });
        const files = await invoke<FileNode[]>('list_workspace_files', { workspacePath: path });
        update((s) => ({
          ...s,
          currentWorkspace: info,
          files,
          isLoading: false,
        }));
        return info;
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        update((s) => ({ ...s, isLoading: false, error }));
        throw e;
      }
    },

    refreshFiles: async () => {
      const state = get({ subscribe });
      if (!state.currentWorkspace) return;

      update((s) => ({ ...s, isLoading: true }));
      try {
        const invoke = await getInvoke();
        const files = await invoke<FileNode[]>('list_workspace_files', {
          workspacePath: state.currentWorkspace.path,
        });
        update((s) => ({ ...s, files, isLoading: false }));
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        update((s) => ({ ...s, isLoading: false, error }));
      }
    },

    loadRecentWorkspaces: async () => {
      try {
        const invoke = await getInvoke();
        const workspaces = await invoke<Workspace[]>('get_recent_workspaces');
        update((s) => ({ ...s, recentWorkspaces: workspaces }));
      } catch (e) {
        console.error('Failed to load recent workspaces:', e);
      }
    },

    closeWorkspace: () => set(defaultState),

    clearError: () => update((s) => ({ ...s, error: null })),
  };
}

export const workspaceStore = createWorkspaceStore();

// Derived stores for convenience
export const currentWorkspace = derived(workspaceStore, ($ws) => $ws.currentWorkspace);
export const workspaceFiles = derived(workspaceStore, ($ws) => $ws.files);
export const hasWorkspace = derived(workspaceStore, ($ws) => $ws.currentWorkspace !== null);
export const workspaceLoading = derived(workspaceStore, ($ws) => $ws.isLoading);
export const workspaceError = derived(workspaceStore, ($ws) => $ws.error);
export const recentWorkspaces = derived(workspaceStore, ($ws) => $ws.recentWorkspaces);
