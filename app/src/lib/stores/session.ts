import { writable, get } from 'svelte/store';
import { getInvoke } from '$lib/utils/tauri';
import { noteTitle } from './note';
import { currentWorkspace } from './workspace';
import { toast } from './toast';

export interface TrackerInfo {
  note_path: string;
  duration_minutes: number;
  opened_at: string;
}

interface SessionStoreState {
  trackerInfo: TrackerInfo | null;
  isLoading: boolean;
  error: string | null;
}

const defaultState: SessionStoreState = {
  trackerInfo: null,
  isLoading: false,
  error: null,
};

function createSessionStore() {
  const { subscribe, set, update } = writable<SessionStoreState>(defaultState);

  return {
    subscribe,

    // Start tracking a note
    startTracking: async (notePath: string) => {
      update((s) => ({ ...s, isLoading: true }));
      try {
        const invoke = await getInvoke();
        await invoke('start_tracking', { notePath });
        const info = await invoke<TrackerInfo | null>('get_tracker_info');
        update((s) => ({ ...s, trackerInfo: info, isLoading: false, error: null }));
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        console.error('[Session] Failed to start tracking:', error);
        toast.warning('Session tracking error');
        update((s) => ({ ...s, isLoading: false, error }));
      }
    },

    // Stop tracking and commit changes (when closing/switching notes)
    stopTracking: async (): Promise<TrackerInfo | null> => {
      try {
        const invoke = await getInvoke();
        const trackerInfo = await invoke<TrackerInfo | null>('stop_tracking');

        // Commit to git if we have valid tracking data
        if (trackerInfo && trackerInfo.note_path !== 'new-note') {
          const workspace = get(currentWorkspace);
          const title = get(noteTitle);

          if (workspace && title) {
            try {
              // Update metadata first
              await invoke('update_note_metadata', { notePath: trackerInfo.note_path });

              // Then commit
              const commitId = await invoke<string>('commit_session', {
                workspacePath: workspace.path,
                notePath: trackerInfo.note_path,
                title,
                durationMinutes: trackerInfo.duration_minutes,
              });
              console.log('[Session] Committed on file close:', commitId);
              toast.success(`Session saved (${formatDuration(trackerInfo.duration_minutes)})`);
            } catch (e) {
              console.error('[Session] Failed to commit on file close:', e);
            }
          }
        }

        set(defaultState);
        return trackerInfo;
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        console.error('[Session] Failed to stop tracking:', error);
        return null;
      }
    },

    // Reset store
    reset: () => {
      set(defaultState);
    },
  };
}

export const sessionStore = createSessionStore();

// Helper to format duration
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
