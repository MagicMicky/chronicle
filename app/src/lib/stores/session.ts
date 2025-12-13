import { writable, derived, get } from 'svelte/store';
import { getInvoke } from '$lib/utils/tauri';
import { noteTitle } from './note';
import { currentWorkspace } from './workspace';

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
  let durationUpdateInterval: ReturnType<typeof setInterval> | null = null;

  const refreshTrackerInfo = async () => {
    try {
      const invoke = await getInvoke();
      const info = await invoke<TrackerInfo | null>('get_tracker_info');
      update((s) => ({ ...s, trackerInfo: info, error: null }));
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.error('[Session] Failed to get tracker info:', error);
      update((s) => ({ ...s, error }));
    }
  };

  // Update duration display every minute
  const startDurationUpdates = () => {
    if (durationUpdateInterval) return;

    durationUpdateInterval = setInterval(async () => {
      await refreshTrackerInfo();
    }, 60000); // Every minute
  };

  const stopDurationUpdates = () => {
    if (durationUpdateInterval) {
      clearInterval(durationUpdateInterval);
      durationUpdateInterval = null;
    }
  };

  return {
    subscribe,

    // Start tracking a note
    startTracking: async (notePath: string) => {
      update((s) => ({ ...s, isLoading: true }));
      try {
        const invoke = await getInvoke();
        await invoke('start_tracking', { notePath });
        await refreshTrackerInfo();
        startDurationUpdates();
        update((s) => ({ ...s, isLoading: false, error: null }));
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        console.error('[Session] Failed to start tracking:', error);
        update((s) => ({ ...s, isLoading: false, error }));
      }
    },

    // Stop tracking and commit changes (when closing/switching notes)
    stopTracking: async (): Promise<TrackerInfo | null> => {
      stopDurationUpdates();
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

    // Refresh tracker info from backend
    refresh: refreshTrackerInfo,

    // Reset store
    reset: () => {
      stopDurationUpdates();
      set(defaultState);
    },
  };
}

export const sessionStore = createSessionStore();

// Derived stores for convenience
export const trackerInfo = derived(sessionStore, ($s) => $s.trackerInfo);
export const sessionDuration = derived(sessionStore, ($s) => $s.trackerInfo?.duration_minutes ?? 0);
export const isTracking = derived(sessionStore, ($s) => $s.trackerInfo !== null);

// Helper to format duration
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
