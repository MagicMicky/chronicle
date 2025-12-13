import { writable, derived, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { currentNote, noteTitle } from './note';
import { currentWorkspace } from './workspace';

export type SessionStateType = 'inactive' | 'active' | 'ended';

export interface SessionInfo {
  note_path: string;
  state: SessionStateType;
  duration_minutes: number;
  annotation_count: number;
  started_at: string | null;
  ended_at: string | null;
}

export interface Session {
  note_path: string;
  state: SessionStateType;
  started_at: string | null;
  ended_at: string | null;
  last_edit_at: string | null;
  duration_minutes: number;
  annotation_count: number;
  last_annotation_at: string | null;
}

interface SessionStoreState {
  sessionInfo: SessionInfo | null;
  isLoading: boolean;
  error: string | null;
}

const defaultState: SessionStoreState = {
  sessionInfo: null,
  isLoading: false,
  error: null,
};

const TIMEOUT_CHECK_INTERVAL_MS = 60000; // Check every minute

function createSessionStore() {
  const { subscribe, set, update } = writable<SessionStoreState>(defaultState);
  let timeoutCheckInterval: ReturnType<typeof setInterval> | null = null;
  let durationUpdateInterval: ReturnType<typeof setInterval> | null = null;

  const refreshSessionInfo = async () => {
    try {
      const info = await invoke<SessionInfo | null>('get_session_info');
      update((s) => ({ ...s, sessionInfo: info, error: null }));
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.error('[Session] Failed to get session info:', error);
      update((s) => ({ ...s, error }));
    }
  };

  const startTimeoutChecks = () => {
    if (timeoutCheckInterval) return;

    timeoutCheckInterval = setInterval(async () => {
      try {
        const endedSession = await invoke<Session | null>('check_session_timeouts');
        if (endedSession) {
          console.log('[Session] Session ended due to timeout:', endedSession);
          const title = get(noteTitle);

          // Save metadata
          if (endedSession.note_path !== 'new-note') {
            try {
              await invoke('save_session_metadata', {
                notePath: endedSession.note_path,
                session: endedSession,
              });
              console.log('[Session] Saved session metadata on timeout');
            } catch (e) {
              console.error('[Session] Failed to save session metadata:', e);
            }

            // Commit to git
            const workspace = get(currentWorkspace);
            if (workspace) {
              try {
                const commitId = await invoke<string>('commit_session', {
                  workspacePath: workspace.path,
                  notePath: endedSession.note_path,
                  title,
                  durationMinutes: endedSession.duration_minutes,
                });
                console.log('[Session] Created session commit on timeout:', commitId);
              } catch (e) {
                console.error('[Session] Failed to create session commit:', e);
              }
            }
          }

          // Refresh info to update UI
          await refreshSessionInfo();
          // Emit event
          window.dispatchEvent(new CustomEvent('session-ended', { detail: endedSession }));
        }
      } catch (e) {
        console.error('[Session] Timeout check failed:', e);
      }
    }, TIMEOUT_CHECK_INTERVAL_MS);
  };

  const stopTimeoutChecks = () => {
    if (timeoutCheckInterval) {
      clearInterval(timeoutCheckInterval);
      timeoutCheckInterval = null;
    }
  };

  // Update duration display every minute
  const startDurationUpdates = () => {
    if (durationUpdateInterval) return;

    durationUpdateInterval = setInterval(async () => {
      await refreshSessionInfo();
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

    // Start tracking a note (loads existing session from metadata if available)
    startTracking: async (notePath: string) => {
      update((s) => ({ ...s, isLoading: true }));
      try {
        // Try to load existing session from metadata
        let existingSession: Session | null = null;
        if (notePath !== 'new-note') {
          try {
            existingSession = await invoke<Session | null>('load_session_metadata', { notePath });
            if (existingSession) {
              console.log('[Session] Loaded existing session from metadata:', existingSession);
            }
          } catch (e) {
            console.warn('[Session] Failed to load session metadata:', e);
          }
        }

        await invoke('start_session_tracking', {
          notePath,
          existingSession,
        });
        await refreshSessionInfo();
        startTimeoutChecks();
        startDurationUpdates();
        update((s) => ({ ...s, isLoading: false, error: null }));
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        console.error('[Session] Failed to start tracking:', error);
        update((s) => ({ ...s, isLoading: false, error }));
      }
    },

    // Stop tracking (when closing a note)
    stopTracking: async (): Promise<Session | null> => {
      stopTimeoutChecks();
      stopDurationUpdates();
      try {
        const session = await invoke<Session | null>('stop_session_tracking');

        // Save session metadata if session ended
        if (session && session.state === 'ended' && session.note_path !== 'new-note') {
          try {
            await invoke('save_session_metadata', {
              notePath: session.note_path,
              session,
            });
            console.log('[Session] Saved session metadata');
          } catch (e) {
            console.error('[Session] Failed to save session metadata:', e);
          }
        }

        set(defaultState);
        return session;
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        console.error('[Session] Failed to stop tracking:', error);
        return null;
      }
    },

    // Record an edit (called on content change)
    recordEdit: async () => {
      try {
        await invoke('record_edit');
        // Don't refresh on every edit - too expensive
        // UI will be updated by duration interval
      } catch (e) {
        console.error('[Session] Failed to record edit:', e);
      }
    },

    // Manually end the session
    endSession: async (): Promise<Session | null> => {
      try {
        const title = get(noteTitle);
        const session = await invoke<Session | null>('end_session');
        await refreshSessionInfo();

        // Save session metadata
        if (session && session.note_path !== 'new-note') {
          try {
            await invoke('save_session_metadata', {
              notePath: session.note_path,
              session,
            });
            console.log('[Session] Saved session metadata on manual end');
          } catch (e) {
            console.error('[Session] Failed to save session metadata:', e);
          }

          // Commit session to git
          const workspace = get(currentWorkspace);
          if (workspace) {
            try {
              const commitId = await invoke<string>('commit_session', {
                workspacePath: workspace.path,
                notePath: session.note_path,
                title,
                durationMinutes: session.duration_minutes,
              });
              console.log('[Session] Created session commit:', commitId);
            } catch (e) {
              console.error('[Session] Failed to create session commit:', e);
            }
          }
        }

        if (session) {
          window.dispatchEvent(new CustomEvent('session-ended', { detail: session }));
        }
        return session;
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        console.error('[Session] Failed to end session:', error);
        update((s) => ({ ...s, error }));
        return null;
      }
    },

    // Refresh session info from backend
    refresh: refreshSessionInfo,

    // Reset store
    reset: () => {
      stopTimeoutChecks();
      stopDurationUpdates();
      set(defaultState);
    },
  };
}

export const sessionStore = createSessionStore();

// Derived stores for convenience
export const sessionInfo = derived(sessionStore, ($s) => $s.sessionInfo);
export const sessionState = derived(sessionStore, ($s) => $s.sessionInfo?.state ?? 'inactive');
export const isSessionActive = derived(sessionStore, ($s) => $s.sessionInfo?.state === 'active');
export const sessionDuration = derived(sessionStore, ($s) => $s.sessionInfo?.duration_minutes ?? 0);
export const annotationCount = derived(sessionStore, ($s) => $s.sessionInfo?.annotation_count ?? 0);

// Helper to format duration
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// Commit a session to git
export async function commitSession(session: Session, title: string): Promise<string | null> {
  const workspace = get(currentWorkspace);
  if (!workspace || session.note_path === 'new-note') {
    console.log('[Session] Skipping commit - no workspace or new note');
    return null;
  }

  try {
    const commitId = await invoke<string>('commit_session', {
      workspacePath: workspace.path,
      notePath: session.note_path,
      title,
      durationMinutes: session.duration_minutes,
    });
    console.log('[Session] Created session commit:', commitId);
    return commitId;
  } catch (e) {
    console.error('[Session] Failed to create session commit:', e);
    return null;
  }
}

// Commit annotations to git
export async function commitAnnotations(session: Session, title: string): Promise<string | null> {
  const workspace = get(currentWorkspace);
  if (!workspace || session.note_path === 'new-note' || session.annotation_count === 0) {
    return null;
  }

  try {
    const commitId = await invoke<string>('commit_annotations', {
      workspacePath: workspace.path,
      notePath: session.note_path,
      title,
      annotationCount: session.annotation_count,
    });
    console.log('[Session] Created annotations commit:', commitId);
    return commitId;
  } catch (e) {
    console.error('[Session] Failed to create annotations commit:', e);
    return null;
  }
}
