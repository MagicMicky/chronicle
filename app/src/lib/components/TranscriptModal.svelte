<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { noteStore } from '$lib/stores/note';
  import { currentWorkspace, workspaceStore } from '$lib/stores/workspace';
  import { sessionStore } from '$lib/stores/session';

  interface Props {
    show: boolean;
    onClose: () => void;
  }

  let { show = false, onClose = () => {} }: Props = $props();

  // Form fields
  let title = $state('');
  let attendees = $state('');
  let transcript = $state('');
  let autoDetectSpeakers = $state(true);
  let processImmediately = $state(true);

  // State
  let saving = $state(false);
  let error = $state('');

  let titleInput: HTMLInputElement | null = $state(null);
  let workspacePath = $state('');

  currentWorkspace.subscribe((w) => {
    workspacePath = w?.path ?? '';
  });

  $effect(() => {
    if (show) {
      // Reset form when modal opens
      title = `Meeting Transcript — ${formatDate(new Date())}`;
      attendees = '';
      transcript = '';
      autoDetectSpeakers = true;
      processImmediately = true;
      error = '';
      saving = false;

      // Auto-focus title input after render
      requestAnimationFrame(() => {
        titleInput?.focus();
        titleInput?.select();
      });
    }
  });

  function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  function slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
  }

  const SPEAKER_PATTERNS: RegExp[] = [
    /^(\[([^\]]+)\]:?\s*)/,                          // [Sarah Chen]: text
    /^(([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s*:\s*)/,     // Sarah Chen: text or Sarah: text
    /^(Speaker\s+(\d+)\s*:\s*)/i,                     // Speaker 1: text
    /^(>\s*([A-Za-z]+)\s*:\s*)/,                      // > Sarah: text
  ];

  function convertSpeakerLabels(input: string): string {
    return input
      .split('\n')
      .map((line) => {
        for (const pattern of SPEAKER_PATTERNS) {
          const match = line.match(pattern);
          if (match) {
            const speaker = match[2].toLowerCase().replace(/\s+/g, '-');
            const rest = line.slice(match[1].length);
            return `@${speaker} ${rest}`;
          }
        }
        return line;
      })
      .join('\n');
  }

  function buildAttendeeMarkers(raw: string): string {
    if (!raw.trim()) return '';
    return raw
      .split(',')
      .map((name) => `@${name.trim().toLowerCase().replace(/\s+/g, '-')}`)
      .join(', ');
  }

  async function handleSave() {
    if (!transcript.trim()) {
      error = 'Please paste a transcript before saving.';
      return;
    }

    if (!workspacePath) {
      error = 'No workspace is open. Open a workspace first.';
      return;
    }

    saving = true;
    error = '';

    try {
      const today = formatDate(new Date());
      const slug = slugify(title || 'transcript');
      const filename = `${today}-transcript-${slug}.md`;
      const filePath = `${workspacePath}/${filename}`;

      // Process transcript content
      let processedTranscript = transcript;
      if (autoDetectSpeakers) {
        processedTranscript = convertSpeakerLabels(transcript);
      }

      // Build attendee markers
      const attendeeMarkers = buildAttendeeMarkers(attendees);

      // Build note content
      const noteContent = [
        `# ${title || 'Meeting Transcript'}`,
        '',
        `**Date:** ${today}`,
        `**Attendees:** ${attendeeMarkers || '(not specified)'}`,
        '**Source:** Pasted transcript',
        '',
        '---',
        '',
        '## Transcript',
        '',
        processedTranscript,
        '',
      ].join('\n');

      // Write file
      await invoke('write_file', { path: filePath, content: noteContent });

      // Refresh workspace file list
      await workspaceStore.refreshFiles();

      // Open the note in the editor
      noteStore.openNote(filePath, noteContent);

      // Start session tracking for the new file
      await sessionStore.startTracking(filePath);

      // Close the modal
      onClose();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      saving = false;
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
    // Cmd/Ctrl + Enter to save
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  }

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }
</script>

{#if show}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="modal-overlay"
    role="dialog"
    aria-modal="true"
    aria-label="Paste Transcript"
    onclick={handleOverlayClick}
    onkeydown={handleKeyDown}
  >
    <div class="modal-card">
      <div class="modal-header">
        <span class="modal-title">Paste Transcript</span>
        <button class="close-btn" onclick={onClose} title="Close">
          &times;
        </button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label for="transcript-title">Title</label>
          <input
            id="transcript-title"
            type="text"
            bind:value={title}
            bind:this={titleInput}
            placeholder="Meeting Transcript"
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label for="transcript-attendees">Attendees</label>
          <input
            id="transcript-attendees"
            type="text"
            bind:value={attendees}
            placeholder="Sarah, Marcus, Alex"
            class="form-input"
          />
          <span class="form-hint">Comma-separated names</span>
        </div>

        <div class="form-group textarea-group">
          <label for="transcript-content">Transcript</label>
          <textarea
            id="transcript-content"
            bind:value={transcript}
            placeholder="Paste your meeting transcript here..."
            class="form-textarea"
          ></textarea>
        </div>

        <div class="form-options">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={autoDetectSpeakers} />
            <span>Auto-detect speaker labels</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={processImmediately} />
            <span>Process immediately after save</span>
          </label>
        </div>

        {#if error}
          <div class="form-error">{error}</div>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" onclick={onClose} disabled={saving}>
          Cancel
        </button>
        <button class="btn btn-primary" onclick={handleSave} disabled={saving}>
          {#if saving}
            Saving...
          {:else}
            Save & Process
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-card {
    background: var(--bg-secondary, #252525);
    border: 1px solid var(--border-color, #333);
    border-radius: 8px;
    width: 600px;
    max-width: 90vw;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color, #333);
    flex-shrink: 0;
  }

  .modal-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary, #e0e0e0);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    font-size: 18px;
    background: transparent;
    border: none;
    color: var(--text-muted, #888);
    cursor: pointer;
    border-radius: 4px;
  }

  .close-btn:hover {
    background: var(--hover-bg, #333);
    color: var(--text-primary, #e0e0e0);
  }

  .modal-body {
    padding: 20px;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .textarea-group {
    flex: 1;
    min-height: 0;
  }

  .form-group label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary, #b0b0b0);
  }

  .form-input {
    padding: 8px 12px;
    font-size: 14px;
    font-family: var(--font-family);
    background: var(--bg-primary, #1e1e1e);
    border: 1px solid var(--border-color, #333);
    border-radius: 4px;
    color: var(--text-primary, #e0e0e0);
    outline: none;
    transition: border-color 0.15s;
  }

  .form-input:focus {
    border-color: var(--accent-color, #0078d4);
  }

  .form-hint {
    font-size: 11px;
    color: var(--text-muted, #888);
  }

  .form-textarea {
    flex: 1;
    min-height: 200px;
    padding: 10px 12px;
    font-size: 13px;
    font-family: var(--font-mono);
    background: var(--bg-primary, #1e1e1e);
    border: 1px solid var(--border-color, #333);
    border-radius: 4px;
    color: var(--text-primary, #e0e0e0);
    outline: none;
    resize: vertical;
    line-height: 1.5;
    transition: border-color 0.15s;
  }

  .form-textarea:focus {
    border-color: var(--accent-color, #0078d4);
  }

  .form-options {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-secondary, #b0b0b0);
    cursor: pointer;
  }

  .checkbox-label input[type='checkbox'] {
    width: 16px;
    height: 16px;
    accent-color: var(--accent-color, #0078d4);
    cursor: pointer;
  }

  .form-error {
    padding: 8px 12px;
    font-size: 13px;
    color: var(--error-color, #f14c4c);
    background: rgba(241, 76, 76, 0.1);
    border: 1px solid rgba(241, 76, 76, 0.3);
    border-radius: 4px;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 16px 20px;
    border-top: 1px solid var(--border-color, #333);
    flex-shrink: 0;
  }

  .btn {
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 500;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: var(--bg-tertiary, #2d2d2d);
    color: var(--text-secondary, #b0b0b0);
    border: 1px solid var(--border-color, #333);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--hover-bg, #333);
  }

  .btn-primary {
    background: var(--accent-color, #0078d4);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--accent-hover, #1a86dc);
  }
</style>
