<script lang="ts">
  import '../app.css';
  import { uiStore } from '$lib/stores/ui';
  import { terminalStore } from '$lib/stores/terminal';
  import { checkClaudeAvailability, aiOutputStore, setAIPanelManualOverride } from '$lib/stores/aiOutput';
  import { checkClaudeInstalled } from '$lib/stores/claudeStatus';
  import { tagsStore, initTagsListener } from '$lib/stores/tags';
  import { actionsStore, initActionsListener } from '$lib/stores/actions';
  import { linksStore, initLinksListener } from '$lib/stores/links';
  import { agentStatusStore, initAgentListeners } from '$lib/stores/agentStatus';
  import {
    commandRunnerRequest,
    openCommandRunner,
    closeCommandRunner,
    type CommandInfo,
  } from '$lib/stores/commands';
  import { listen as tauriListen } from '@tauri-apps/api/event';
  import { hasOpenNote, isNoteDirty, noteStore, currentNote, loadLastSession, saveLastSession, openDailyNote } from '$lib/stores/note';
  import { workspaceStore, currentWorkspace, hasWorkspace } from '$lib/stores/workspace';
  import { sessionStore } from '$lib/stores/session';
  import { autoSaveStore } from '$lib/stores/autosave';
  import { toast } from '$lib/stores/toast';
  import { getInvoke } from '$lib/utils/tauri';
  import { get } from 'svelte/store';
  import { onMount } from 'svelte';
  import StatusBar from '$lib/layout/StatusBar.svelte';
  import Toasts from '$lib/layout/Toasts.svelte';
  import ShortcutGuide from '$lib/components/ShortcutGuide.svelte';
  import QuickOpen from '$lib/components/QuickOpen.svelte';
  import SearchModal from '$lib/components/SearchModal.svelte';
  import Onboarding from '$lib/components/Onboarding.svelte';
  import ArchiveView from '$lib/components/ArchiveView.svelte';
  import CommandRunner from '$lib/components/CommandRunner.svelte';
  import ActionDashboard from '$lib/components/ActionDashboard.svelte';
  import TranscriptModal from '$lib/components/TranscriptModal.svelte';
  import type { UnlistenFn } from '@tauri-apps/api/event';
  import { getCurrentWindow } from '@tauri-apps/api/window';

  interface Props {
    children: import('svelte').Snippet;
  }

  let { children }: Props = $props();
  /** Process the current note via claude -p */
  async function processCurrentNote() {
    const note = get(currentNote);
    const ws = get(currentWorkspace);
    if (!note?.path || !ws?.path) return;

    aiOutputStore.setProcessing(true);
    try {
      const inv = await getInvoke();
      await inv('process_note', { workspacePath: ws.path, notePath: note.path });
      // Result/error will arrive via claude:task-completed / claude:task-error events
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      aiOutputStore.setError(msg);
    }
  }

  let showShortcuts = $state(false);
  let showQuickOpen = $state(false);
  let showSearch = $state(false);
  let showOnboarding = $state(false);
  let showArchive = $state(false);
  let showActionDashboard = $state(false);
  let showTranscriptModal = $state(false);

  // Command runner state driven by store
  // undefined = closed, null = open with no preselection, CommandInfo = open with preselection
  let commandRunnerState: CommandInfo | null | undefined = $state(undefined);
  $effect(() => commandRunnerRequest.subscribe((v) => (commandRunnerState = v)));

  // Check onboarding on mount (set in onMount below)
  if (typeof localStorage !== 'undefined') {
    showOnboarding = !localStorage.getItem('chronicle:onboarded');
  }

  async function restoreLastSession() {
    const session = loadLastSession();
    if (!session) return;

    try {
      // Try to open the workspace
      await workspaceStore.openWorkspace(session.workspacePath);

      // Try to open the file
      const invoke = await getInvoke();
      const content = await invoke<string>('read_file', { path: session.filePath });
      noteStore.openNote(session.filePath, content);

      // Re-persist the session (workspace open succeeded)
      saveLastSession(session.workspacePath, session.filePath);

      // Start session tracking
      await sessionStore.startTracking(session.filePath);
    } catch {
      // Workspace or file no longer exists — show empty state gracefully
    }
  }

  onMount(() => {
    let destroyed = false;

    // Theme initialization: check saved preference, then system preference
    const savedTheme = localStorage.getItem('chronicle-theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      document.documentElement.setAttribute('data-theme', 'light');
    }

    // Listen for system theme changes when no explicit preference is saved
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    function handleSystemThemeChange(e: MediaQueryListEvent) {
      if (!localStorage.getItem('chronicle-theme')) {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      }
    }
    mediaQuery.addEventListener('change', handleSystemThemeChange);

    // Check Claude CLI availability
    checkClaudeAvailability();
    checkClaudeInstalled();

    // Initialize chronicle intelligence listeners (tags, actions, links, agents)
    const intelligenceCleanups: (() => void)[] = [];
    Promise.all([
      initTagsListener(),
      initActionsListener(),
      initLinksListener(),
      initAgentListeners(),
    ]).then(([tagsUn, actionsUn, linksUn, agentUns]) => {
      if (destroyed) {
        tagsUn();
        actionsUn();
        linksUn();
        agentUns.forEach((fn: () => void) => fn());
      } else {
        intelligenceCleanups.push(tagsUn, actionsUn, linksUn, ...agentUns);
      }
    });

    // Listen for claude:task-started / completed / error for process_note flow
    let claudeTaskCleanups: (() => void)[] = [];
    Promise.all([
      tauriListen<{ task: string; note?: string }>('claude:task-started', (event) => {
        if (event.payload.task === 'process') {
          aiOutputStore.setProcessing(true);
        }
      }),
      tauriListen<{ task: string; note?: string; result: unknown }>('claude:task-completed', (event) => {
        if (event.payload.task === 'process') {
          aiOutputStore.setProcessing(false);
          // Don't clear or set dummy result — the chronicle:processed-updated
          // watcher event (or loadProcessedFromChronicle effect) will load the
          // real result once Claude finishes writing the processed file.
        }
      }),
      tauriListen<{ task: string; error: string }>('claude:task-error', (event) => {
        if (event.payload.task === 'process') {
          aiOutputStore.setError(event.payload.error);
        }
      }),
      // Listen for claude:output-line to stream output to AI panel
      tauriListen<{ line: string; is_stderr: boolean }>('claude:output-line', (event) => {
        aiOutputStore.appendLine(event.payload.line);
      }),
      // Listen for chronicle:processed-updated to reload processed data
      tauriListen('chronicle:processed-updated', () => {
        // Processed files changed - reload for current note
        const note = get(currentNote);
        const ws = get(currentWorkspace);
        if (note?.path && ws?.path) {
          const filename = note.path.split('/').pop()?.replace(/\.md$/, '') ?? '';
          if (filename) {
            import('@tauri-apps/api/core').then(({ invoke }) => {
              invoke('read_processed', { workspacePath: ws.path, noteName: filename }).then((data: unknown) => {
                const d = data as Record<string, unknown> | null;
                if (d && typeof d === 'object' && d.tldr) {
                  aiOutputStore.setResult({
                    path: note.path ?? '',
                    processedAt: d.processedAt ? new Date(d.processedAt as string) : new Date(),
                    summary: (d.tldr as string) ?? '',
                    style: 'standard',
                    tokens: { input: 0, output: 0 },
                    sections: {
                      tldr: (d.tldr as string) ?? null,
                      keyPoints: ((d.keyPoints as Array<any>) ?? []).map((kp: any) =>
                        typeof kp === 'string' ? { text: kp } : { text: kp.text, sourceLines: kp.sourceLines }
                      ),
                      actions: ((d.actionItems as Array<{ text: string; owner?: string; done?: boolean; sourceLine?: number }>) ?? []).map((a) => ({
                        text: a.text,
                        owner: a.owner ?? null,
                        completed: a.done ?? false,
                        sourceLine: a.sourceLine,
                      })),
                      questions: ((d.questions as Array<any>) ?? []).map((q: any) =>
                        typeof q === 'string' ? { text: q } : { text: q.text, sourceLine: q.sourceLine }
                      ),
                      rawNotes: null,
                    },
                  });
                }
              }).catch(() => {});
            });
          }
        }
      }),
    ]).then((unlisteners) => {
      if (destroyed) {
        unlisteners.forEach((fn) => fn());
      } else {
        claudeTaskCleanups = unlisteners;
      }
    });

    // Load initial intelligence data when workspace is available
    const wsUnsub = currentWorkspace.subscribe((ws) => {
      if (ws) {
        tagsStore.load();
        actionsStore.load();
        linksStore.load();
        agentStatusStore.loadStatus();
      }
    });

    // Idle timer: trigger background agents after 2 min of no edits
    const IDLE_TIMEOUT_MS = 2 * 60 * 1000;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    function resetIdleTimer() {
      if (idleTimer) clearTimeout(idleTimer);
      if (!get(hasWorkspace)) return;
      idleTimer = setTimeout(async () => {
        const ws = get(currentWorkspace);
        if (!ws) return;
        try {
          const inv = await getInvoke();
          await inv('run_background_agents', { workspacePath: ws.path });
        } catch (err) {
          console.error('Background agents failed:', err);
        }
      }, IDLE_TIMEOUT_MS);
    }

    // Reset idle timer on content changes via autosave's onContentChange
    // We listen for dirty state changes as a proxy for edits
    const dirtyUnsub = isNoteDirty.subscribe((dirty) => {
      if (dirty) {
        resetIdleTimer();
      }
    });

    // Start idle timer initially
    resetIdleTimer();

    // Restore last session (workspace + file)
    restoreLastSession();

    // Warn before closing with unsaved changes (web beforeunload fallback)
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (get(isNoteDirty)) {
        e.preventDefault();
        autoSaveStore.saveNow();
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Listen for chronicle:toast custom events (e.g. from StatusBar process button)
    const handleToastEvent = (e: CustomEvent) => {
      const { type, message, duration } = e.detail;
      if (type === 'warning') toast.warning(message, duration);
      else if (type === 'error') toast.error(message, duration);
      else if (type === 'success') toast.success(message, duration);
      else toast.info(message, duration);
    };
    window.addEventListener('chronicle:toast', handleToastEvent as EventListener);

    // Listen for custom event to open archive from Explorer
    function handleShowArchive() {
      showArchive = true;
    }
    document.addEventListener('chronicle:show-archive', handleShowArchive);

    // Listen for custom event to open action dashboard
    function handleShowActions() {
      showActionDashboard = true;
    }
    window.addEventListener('chronicle:show-actions', handleShowActions);

    // Listen for custom event to open transcript modal
    function handlePasteTranscript() {
      showTranscriptModal = true;
    }
    window.addEventListener('chronicle:paste-transcript', handlePasteTranscript);

    // Tauri native close-requested handler: save + commit before closing
    let closeUnlisten: UnlistenFn | undefined;
    getCurrentWindow().onCloseRequested(async (event) => {
      if (get(isNoteDirty)) {
        event.preventDefault();
        try {
          await autoSaveStore.saveNow();
          await sessionStore.stopTracking();
          // Close the window after successful save
          await getCurrentWindow().close();
        } catch {
          // Save failed - ask user if they want to close anyway
          const { confirm } = await import('@tauri-apps/plugin-dialog');
          const shouldClose = await confirm(
            "Changes couldn't be saved. Close anyway?",
            { title: 'Unsaved Changes', kind: 'warning' }
          );
          if (shouldClose) {
            await getCurrentWindow().destroy();
          }
        }
      } else {
        // No unsaved changes, still commit session before closing
        await sessionStore.stopTracking();
      }
    }).then((unlisten) => {
      if (destroyed) {
        unlisten();
      } else {
        closeUnlisten = unlisten;
      }
    });

    function handleKeyDown(e: KeyboardEvent) {
      // Cmd/Ctrl + S: Save now
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 's') {
        e.preventDefault();
        if (get(hasOpenNote)) {
          autoSaveStore.saveNow();
        }
      }
      // Cmd/Ctrl + B: Toggle Explorer
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        uiStore.toggleCollapse('explorer');
      }
      // Cmd/Ctrl + Shift + A: Toggle AI Output (manual override)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        setAIPanelManualOverride();
        uiStore.toggleCollapse('aiOutput');
      }
      // Cmd/Ctrl + P: Quick file jump
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'p') {
        e.preventDefault();
        showQuickOpen = !showQuickOpen;
      }
      // Cmd/Ctrl + Shift + P: Trigger AI Processing
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        if (get(hasOpenNote)) {
          processCurrentNote();
        }
      }
      // Cmd/Ctrl + T: Open today's daily note
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 't') {
        e.preventDefault();
        const workspace = get(currentWorkspace);
        if (workspace) {
          openDailyNote(workspace.path).catch((err) => {
            console.error('Failed to open daily note:', err);
            toast.error('Failed to open daily note');
          });
        } else {
          toast.warning('Open a workspace first');
        }
      }
      // Cmd/Ctrl + W: Close current note (save first, stop session)
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'w') {
        e.preventDefault();
        if (get(hasOpenNote)) {
          (async () => {
            try {
              if (get(isNoteDirty)) {
                await autoSaveStore.saveNow();
              }
              await sessionStore.stopTracking();
              noteStore.closeNote();
            } catch (err) {
              console.error('Failed to close note:', err);
            }
          })();
        }
      }
      // Cmd/Ctrl + Enter: Process current note (alias for Cmd+Shift+P)
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (get(hasOpenNote)) {
          processCurrentNote();
        }
      }
      // Cmd/Ctrl + N: New note (show template selector)
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'n') {
        e.preventDefault();
        if (get(hasWorkspace)) {
          window.dispatchEvent(new CustomEvent('chronicle:new-note'));
        } else {
          toast.warning('Open a workspace first');
        }
      }
      // Cmd/Ctrl + \: Toggle sidebar (alias for Cmd+B)
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        uiStore.toggleCollapse('explorer');
      }
      // Cmd/Ctrl + J: Toggle AI panel (alias for Cmd+Shift+A, manual override)
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'j') {
        e.preventDefault();
        setAIPanelManualOverride();
        uiStore.toggleCollapse('aiOutput');
      }
      // Cmd/Ctrl + Shift + F: Search across notes
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        if (get(hasWorkspace)) {
          showSearch = !showSearch;
        }
      }
      // Cmd/Ctrl + Shift + F11: Toggle Focus Mode
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'F11') {
        e.preventDefault();
        uiStore.toggleFocusMode();
      }
      // Escape: Exit focus mode (only when focus mode is active and no modals are open)
      if (e.key === 'Escape' && get(uiStore).focusMode && !showShortcuts && !showQuickOpen && !showSearch && !showOnboarding) {
        e.preventDefault();
        uiStore.setFocusMode(false);
      }
      // Cmd/Ctrl + Shift + C: Copy raw note to clipboard
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        const note = get(currentNote);
        if (note?.content) {
          navigator.clipboard.writeText(note.content).then(
            () => toast.success('Note copied to clipboard', 2000),
            () => toast.error('Failed to copy note')
          );
        }
      }
      // Cmd/Ctrl + /: Toggle shortcut guide
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        showShortcuts = !showShortcuts;
      }
      // Cmd/Ctrl + `: Toggle Terminal (expand/collapse)
      if ((e.metaKey || e.ctrlKey) && e.key === '`') {
        e.preventDefault();
        const ui = get(uiStore);
        uiStore.toggleCollapse('terminal');
        if (ui.collapsed.terminal) {
          // Was collapsed, now expanding - request focus after render
          requestAnimationFrame(() => {
            terminalStore.requestFocus();
          });
        }
      }
      // Cmd/Ctrl + Shift + H: Open Archive (History)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'H') {
        e.preventDefault();
        showArchive = !showArchive;
      }
      // Cmd/Ctrl + Shift + R: Toggle Command Runner
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        if (commandRunnerState !== undefined) {
          closeCommandRunner();
        } else {
          openCommandRunner();
        }
      }
      // Cmd/Ctrl + Shift + T: Open Transcript Modal
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        showTranscriptModal = true;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      destroyed = true;
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('chronicle:toast', handleToastEvent as EventListener);
      document.removeEventListener('chronicle:show-archive', handleShowArchive);
      window.removeEventListener('chronicle:show-actions', handleShowActions);
      window.removeEventListener('chronicle:paste-transcript', handlePasteTranscript);
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
      intelligenceCleanups.forEach((fn) => fn());
      claudeTaskCleanups.forEach((fn) => fn());
      closeUnlisten?.();
      wsUnsub();
      dirtyUnsub();
      if (idleTimer) clearTimeout(idleTimer);
    };
  });
</script>

<div class="app-container" class:focus-mode={$uiStore.focusMode}>
  <div class="app-content">
    {@render children()}
  </div>
  {#if !$uiStore.focusMode}
    <StatusBar />
  {/if}
</div>

<ShortcutGuide bind:show={showShortcuts} />
<QuickOpen bind:show={showQuickOpen} />
<SearchModal bind:show={showSearch} />
<Onboarding bind:show={showOnboarding} />
<ArchiveView bind:show={showArchive} />
<Toasts />

{#if commandRunnerState !== undefined}
  <CommandRunner
    onclose={closeCommandRunner}
    preselectedCommand={commandRunnerState}
  />
{/if}

{#if showActionDashboard}
  <ActionDashboard onClose={() => (showActionDashboard = false)} />
{/if}

<TranscriptModal
  show={showTranscriptModal}
  onClose={() => (showTranscriptModal = false)}
/>

<style>
  .app-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  .app-content {
    flex: 1;
    display: flex;
    min-height: 0;
    overflow: hidden;
  }
</style>
