<script lang="ts">
  import '../app.css';
  import { uiStore } from '$lib/stores/ui';
  import { terminalStore } from '$lib/stores/terminal';
  import { initAIEventListeners, triggerProcessing, setAIPanelManualOverride } from '$lib/stores/aiOutput';
  import { hasOpenNote, isNoteDirty, noteStore, loadLastSession, saveLastSession, openDailyNote } from '$lib/stores/note';
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
  import type { UnlistenFn } from '@tauri-apps/api/event';
  import { getCurrentWindow } from '@tauri-apps/api/window';

  interface Props {
    children: import('svelte').Snippet;
  }

  let { children }: Props = $props();
  let showShortcuts = $state(false);
  let showQuickOpen = $state(false);
  let showSearch = $state(false);

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
    let aiUnlisteners: UnlistenFn[] = [];
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

    // Initialize AI event listeners
    initAIEventListeners().then((unlisteners) => {
      if (destroyed) {
        // Component unmounted before listeners were ready — clean up immediately
        unlisteners.forEach((fn) => fn());
      } else {
        aiUnlisteners = unlisteners;
      }
    });

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
          triggerProcessing();
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
          triggerProcessing();
        }
      }
      // Cmd/Ctrl + N: New note
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'n') {
        e.preventDefault();
        if (get(hasWorkspace)) {
          noteStore.newNote();
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
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      destroyed = true;
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
      aiUnlisteners.forEach((fn) => fn());
      closeUnlisten?.();
    };
  });
</script>

<div class="app-container">
  <div class="app-content">
    {@render children()}
  </div>
  <StatusBar />
</div>

<ShortcutGuide bind:show={showShortcuts} />
<QuickOpen bind:show={showQuickOpen} />
<SearchModal bind:show={showSearch} />
<Toasts />

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
