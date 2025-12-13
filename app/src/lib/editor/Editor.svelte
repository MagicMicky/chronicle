<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { EditorState } from '@codemirror/state';
  import { EditorView } from '@codemirror/view';
  import { createExtensionsWithKeymap } from './extensions';
  import { noteStore, hasOpenNote, noteTitle, isNoteDirty } from '../stores/note';
  import { autoSaveStore } from '../stores/autosave';
  import { hasWorkspace } from '../stores/workspace';

  let editorContainer: HTMLDivElement | undefined;
  let editorView: EditorView | null = null;
  let isUpdatingFromStore = false;

  // Subscribe to store changes
  let unsubscribe: (() => void) | null = null;
  let currentHasOpenNote = false;
  let currentNoteTitle = '';
  let currentIsDirty = false;
  let pendingContent: string | null = null;

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
      extensions: createExtensionsWithKeymap(handleContentChange),
    });

    editorView = new EditorView({
      state,
      parent: editorContainer,
    });

    pendingContent = null;
    editorView.focus();
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

    // Subscribe to note store
    unsubscribe = noteStore.subscribe((state) => {
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
    if (editorView) {
      editorView.destroy();
      editorView = null;
    }
  });

  // Handle new note creation
  function handleNewNote() {
    noteStore.newNote();
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
    {#if !currentHasOpenNote}
      <button class="new-note-btn" on:click={handleNewNote} title="New Note (Cmd+N)">
        + New
      </button>
    {/if}
  </div>
  <div class="pane-content" class:has-editor={currentHasOpenNote}>
    {#if currentHasOpenNote}
      <div class="editor-container" bind:this={editorContainer}></div>
    {:else}
      <div class="placeholder">
        <span class="placeholder-icon">&#128221;</span>
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
