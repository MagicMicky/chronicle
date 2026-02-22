<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { EditorState } from '@codemirror/state';
  import { EditorView } from '@codemirror/view';
  import { createExtensionsWithKeymap } from './extensions';
  import { noteStore, hasOpenNote, noteTitle, isNoteDirty } from '../stores/note';
  import { autoSaveStore } from '../stores/autosave';
  import { sessionStore } from '../stores/session';
  import { FileText } from 'lucide-svelte';

  let editorContainer: HTMLDivElement | undefined;
  let editorView: EditorView | null = null;
  let isUpdatingFromStore = false;

  // Subscribe to store changes
  let unsubscribe: (() => void) | null = null;
  let currentHasOpenNote = false;
  let currentNoteTitle = '';
  let currentIsDirty = false;
  let pendingContent: string | null = null;
  let themeObserver: MutationObserver | null = null;
  let scrollSaveTimeout: ReturnType<typeof setTimeout> | null = null;
  let currentFilePath: string | null = null;

  const SCROLL_KEY_PREFIX = 'chronicle:scroll:';

  function saveScrollPosition() {
    if (!editorView || !currentFilePath) return;
    const scrollTop = editorView.scrollDOM.scrollTop;
    try {
      localStorage.setItem(SCROLL_KEY_PREFIX + currentFilePath, String(scrollTop));
    } catch {
      // Ignore storage errors
    }
  }

  function restoreScrollPosition() {
    if (!editorView || !currentFilePath) return;
    try {
      const saved = localStorage.getItem(SCROLL_KEY_PREFIX + currentFilePath);
      if (saved) {
        const scrollTop = parseInt(saved, 10);
        if (!isNaN(scrollTop)) {
          requestAnimationFrame(() => {
            editorView?.scrollDOM.scrollTo(0, scrollTop);
          });
        }
      }
    } catch {
      // Ignore storage errors
    }
  }

  function debouncedSaveScroll() {
    if (scrollSaveTimeout) clearTimeout(scrollSaveTimeout);
    scrollSaveTimeout = setTimeout(saveScrollPosition, 500);
  }

  // Detect current theme from data-theme attribute
  function getCurrentTheme(): 'light' | 'dark' {
    if (typeof document === 'undefined') return 'dark';
    return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'dark';
  }

  // Handle content changes from the editor
  function handleContentChange(content: string) {
    if (!isUpdatingFromStore) {
      noteStore.updateContent(content);
      // Trigger auto-save debounce
      autoSaveStore.onContentChange();
    }
  }

  // Create a new editor view
  function createEditor(initialContent: string = '') {
    if (!editorContainer) {
      // Container not ready yet, store content for later
      pendingContent = initialContent;
      return;
    }

    if (editorView) {
      editorView.destroy();
    }

    const state = EditorState.create({
      doc: initialContent,
      extensions: createExtensionsWithKeymap(handleContentChange, { theme: getCurrentTheme() }),
    });

    editorView = new EditorView({
      state,
      parent: editorContainer,
    });

    // Listen for scroll events to persist scroll position
    editorView.scrollDOM.addEventListener('scroll', debouncedSaveScroll);

    pendingContent = null;
    editorView.focus();
    restoreScrollPosition();
  }

  // Update editor content from store (when opening a file)
  function updateEditorContent(content: string) {
    if (!editorView) return;

    const currentContent = editorView.state.doc.toString();
    if (currentContent !== content) {
      isUpdatingFromStore = true;
      editorView.dispatch({
        changes: {
          from: 0,
          to: currentContent.length,
          insert: content,
        },
      });
      isUpdatingFromStore = false;
    }
  }

  // Try to create editor when container becomes available
  async function tryCreateEditor(content: string) {
    // Wait for DOM to update
    await tick();

    if (editorContainer && !editorView) {
      createEditor(content);
    }
  }

  onMount(() => {
    // Subscribe to derived stores for header display
    const unsubHasNote = hasOpenNote.subscribe((v) => {
      currentHasOpenNote = v;
      // If we have pending content and the container should now exist, try creating
      if (v && pendingContent !== null) {
        tryCreateEditor(pendingContent);
      }
    });
    const unsubTitle = noteTitle.subscribe((v) => (currentNoteTitle = v));
    const unsubDirty = isNoteDirty.subscribe((v) => (currentIsDirty = v));

    // Watch for theme changes to rebuild editor with correct syntax colors
    themeObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          // Rebuild editor with new theme syntax highlighting
          if (editorView) {
            const content = editorView.state.doc.toString();
            createEditor(content);
          }
        }
      }
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // Subscribe to note store
    unsubscribe = noteStore.subscribe((state) => {
      const newPath = state.currentNote?.path ?? null;
      if (newPath !== currentFilePath) {
        // Save scroll position of the previous file before switching
        saveScrollPosition();
        currentFilePath = newPath;
      }
      if (state.currentNote) {
        if (!editorView) {
          tryCreateEditor(state.currentNote.content);
        } else {
          updateEditorContent(state.currentNote.content);
        }
      } else if (editorView) {
        editorView.destroy();
        editorView = null;
      }
    });

    return () => {
      unsubHasNote();
      unsubTitle();
      unsubDirty();
    };
  });

  onDestroy(() => {
    if (unsubscribe) unsubscribe();
    themeObserver?.disconnect();
    if (scrollSaveTimeout) clearTimeout(scrollSaveTimeout);
    saveScrollPosition();
    if (editorView) {
      editorView.scrollDOM.removeEventListener('scroll', debouncedSaveScroll);
      editorView.destroy();
      editorView = null;
    }
  });

  // Handle new note creation — dispatch event so template selector opens
  function handleNewNote() {
    window.dispatchEvent(new CustomEvent('chronicle:new-note'));
  }

  // Focus the editor
  export function focus() {
    editorView?.focus();
  }
</script>

<div class="editor">
  <div class="pane-header">
    <span class="pane-title">
      {#if currentHasOpenNote}
        {currentNoteTitle}{#if currentIsDirty}<span class="dirty-indicator">*</span>{/if}
      {:else}
        Editor
      {/if}
    </span>
    <button class="new-note-btn" on:click={handleNewNote} title="New Note (Cmd+N)" aria-label="New Note">
      + New
    </button>
  </div>
  <div class="pane-content" class:has-editor={currentHasOpenNote}>
    {#if currentHasOpenNote}
      <div class="editor-container" bind:this={editorContainer}></div>
    {:else}
      <div class="placeholder">
        <span class="placeholder-icon"><FileText size={32} /></span>
        <span class="placeholder-text">Markdown Editor</span>
        <span class="placeholder-hint">Create or open a note to start writing</span>
        <button class="placeholder-btn" on:click={handleNewNote}>
          Create New Note
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .editor {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--editor-bg, #1e1e1e);
  }

  .pane-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--header-bg, #252525);
    border-bottom: 1px solid var(--border-color, #333);
    min-height: 36px;
  }

  .pane-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted, #888);
  }

  .dirty-indicator {
    color: var(--warning-color, #cca700);
    margin-left: 2px;
  }

  .new-note-btn {
    font-size: 11px;
    padding: 4px 8px;
    border-radius: 4px;
    background: var(--accent-color, #0078d4);
    color: white;
    transition: background 0.15s;
  }

  .new-note-btn:hover {
    background: var(--accent-hover, #1a86dc);
  }

  .pane-content {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .pane-content.has-editor {
    align-items: stretch;
    justify-content: stretch;
  }

  .editor-container {
    width: 100%;
    height: 100%;
    overflow: auto;
  }

  /* CodeMirror container styling */
  .editor-container :global(.cm-editor) {
    height: 100%;
    outline: none;
  }

  .editor-container :global(.cm-scroller) {
    overflow: auto;
  }

  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: var(--text-muted, #666);
  }

  .placeholder-icon {
    font-size: 48px;
    opacity: 0.5;
  }

  .placeholder-text {
    font-size: 16px;
    font-weight: 500;
  }

  .placeholder-hint {
    font-size: 13px;
    opacity: 0.7;
  }

  .placeholder-btn {
    margin-top: 16px;
    padding: 8px 16px;
    font-size: 13px;
    border-radius: 4px;
    background: var(--accent-color, #0078d4);
    color: white;
    transition: background 0.15s;
  }

  .placeholder-btn:hover {
    background: var(--accent-hover, #1a86dc);
  }
</style>
