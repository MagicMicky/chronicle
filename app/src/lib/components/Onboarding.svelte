<script lang="ts">
  import { workspaceStore } from '$lib/stores/workspace';
  import { invoke } from '@tauri-apps/api/core';
  import { open } from '@tauri-apps/plugin-dialog';
  import { FolderOpen, FolderPlus, Check, AlertTriangle, RefreshCw, Loader2 } from 'lucide-svelte';

  interface Props {
    show: boolean;
  }

  let { show = $bindable(false) }: Props = $props();

  let step = $state(0);
  let claudeInstalled = $state<boolean | null>(null);
  let claudeChecking = $state(false);
  let workspaceSelected = $state(false);

  const totalSteps = 4;

  async function checkClaude() {
    claudeChecking = true;
    try {
      claudeInstalled = await invoke<boolean>('check_claude_installed');
    } catch {
      claudeInstalled = false;
    }
    claudeChecking = false;
  }

  async function pickFolder() {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === 'string') {
      await workspaceStore.openWorkspace(selected);
      workspaceSelected = true;
      step = 2;
    }
  }

  async function createFolder() {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === 'string') {
      await workspaceStore.openWorkspace(selected);
      workspaceSelected = true;
      step = 2;
    }
  }

  function nextStep() {
    if (step < totalSteps - 1) {
      step++;
      if (step === 2) {
        checkClaude();
      }
    }
  }

  function prevStep() {
    if (step > 0) step--;
  }

  function finish() {
    localStorage.setItem('chronicle:onboarded', 'true');
    show = false;
  }
</script>

{#if show}
  <div class="overlay" role="dialog" aria-label="Welcome to Chronicle" aria-modal="true">
    <div class="modal">
      <!-- Step indicators -->
      <div class="steps">
        {#each Array(totalSteps) as _, i}
          <div class="step-dot" class:active={i === step} class:completed={i < step}></div>
        {/each}
      </div>

      <div class="modal-body">
        {#if step === 0}
          <!-- Step 1: Welcome -->
          <div class="step-content welcome">
            <h1>Welcome to Chronicle</h1>
            <p class="subtitle">
              A local-first, AI-powered note-taking app. Capture your thoughts in markdown
              with semantic markers, then let Claude process them into structured summaries
              with action items and insights.
            </p>
            <p class="detail">Your notes stay on your machine. Always.</p>
            <button class="primary-btn" onclick={nextStep}>Get Started</button>
          </div>

        {:else if step === 1}
          <!-- Step 2: Pick workspace -->
          <div class="step-content">
            <h2>Pick your notes folder</h2>
            <p class="subtitle">Choose where Chronicle will store your notes. Each folder becomes a workspace with git version control.</p>
            <div class="folder-options">
              <button class="folder-btn" onclick={pickFolder}>
                <FolderOpen size={24} />
                <span class="folder-btn-label">Open Existing Folder</span>
                <span class="folder-btn-hint">Use a folder you already have</span>
              </button>
              <button class="folder-btn" onclick={createFolder}>
                <FolderPlus size={24} />
                <span class="folder-btn-label">Create New Folder</span>
                <span class="folder-btn-hint">Start fresh with a new workspace</span>
              </button>
            </div>
            {#if workspaceSelected}
              <div class="check-result success">
                <Check size={16} />
                <span>Workspace ready</span>
              </div>
            {/if}
            <div class="nav-buttons">
              <button class="secondary-btn" onclick={prevStep}>Back</button>
              <button class="primary-btn" onclick={nextStep} disabled={!workspaceSelected}>Next</button>
            </div>
          </div>

        {:else if step === 2}
          <!-- Step 3: Claude Code check -->
          <div class="step-content">
            <h2>Claude Code</h2>
            <p class="subtitle">Chronicle uses Claude Code for AI-powered note processing. Let's check if it's installed.</p>
            <div class="claude-check">
              {#if claudeChecking}
                <div class="check-result checking">
                  <Loader2 size={16} class="spin-icon" />
                  <span>Checking...</span>
                </div>
              {:else if claudeInstalled === true}
                <div class="check-result success">
                  <Check size={16} />
                  <span>Claude Code is ready!</span>
                </div>
              {:else if claudeInstalled === false}
                <div class="check-result warning">
                  <AlertTriangle size={16} />
                  <span>Claude Code not found</span>
                </div>
                <p class="install-hint">
                  Install Claude Code from
                  <a href="https://claude.ai/download" target="_blank" rel="noopener noreferrer">claude.ai/download</a>
                  to enable AI features.
                </p>
                <button class="secondary-btn check-again" onclick={checkClaude}>
                  <RefreshCw size={14} />
                  Check Again
                </button>
              {/if}
            </div>
            <div class="nav-buttons">
              <button class="secondary-btn" onclick={prevStep}>Back</button>
              <button class="primary-btn" onclick={nextStep}>
                {claudeInstalled ? 'Next' : 'Skip for now'}
              </button>
            </div>
          </div>

        {:else if step === 3}
          <!-- Step 4: Quick tips -->
          <div class="step-content">
            <h2>Quick Tips</h2>
            <p class="subtitle">Use these markers in your notes for smart categorization:</p>
            <div class="markers-grid">
              <div class="marker-row">
                <kbd>&gt;</kbd>
                <span>Key insight or decision</span>
              </div>
              <div class="marker-row">
                <kbd>!</kbd>
                <span>Important / urgent item</span>
              </div>
              <div class="marker-row">
                <kbd>?</kbd>
                <span>Open question</span>
              </div>
              <div class="marker-row">
                <kbd>[]</kbd>
                <span>Action item / to-do</span>
              </div>
              <div class="marker-row">
                <kbd>@</kbd>
                <span>Person mention</span>
              </div>
            </div>
            <div class="tips-shortcuts">
              <p><kbd>Cmd+T</kbd> Open today's daily note</p>
              <p><kbd>Cmd+Enter</kbd> Process note with AI</p>
              <p><kbd>Cmd+P</kbd> Quick file jump</p>
            </div>
            <div class="nav-buttons">
              <button class="secondary-btn" onclick={prevStep}>Back</button>
              <button class="primary-btn" onclick={finish}>Get Started</button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  }

  .modal {
    background: var(--bg-secondary, #252525);
    border: 1px solid var(--border-color, #333);
    border-radius: 12px;
    max-width: 480px;
    width: 90%;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
    overflow: hidden;
  }

  .steps {
    display: flex;
    justify-content: center;
    gap: 8px;
    padding: 20px 20px 0;
  }

  .step-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--border-color, #333);
    transition: background 0.2s, transform 0.2s;
  }

  .step-dot.active {
    background: var(--accent-color, #0078d4);
    transform: scale(1.25);
  }

  .step-dot.completed {
    background: var(--success-color, #4ec9b0);
  }

  .modal-body {
    padding: 24px 32px 32px;
  }

  .step-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .step-content h1 {
    margin: 0 0 12px;
    font-size: 24px;
    font-weight: 700;
    color: var(--text-primary, #e0e0e0);
  }

  .step-content h2 {
    margin: 0 0 8px;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary, #e0e0e0);
  }

  .subtitle {
    margin: 0 0 16px;
    font-size: 14px;
    color: var(--text-secondary, #b0b0b0);
    line-height: 1.5;
  }

  .detail {
    margin: 0 0 24px;
    font-size: 13px;
    color: var(--text-muted, #888);
    font-style: italic;
  }

  .primary-btn {
    padding: 10px 24px;
    background: var(--accent-color, #0078d4);
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }

  .primary-btn:hover:not(:disabled) {
    background: var(--accent-hover, #1a86dc);
  }

  .primary-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .secondary-btn {
    padding: 8px 16px;
    background: transparent;
    color: var(--text-secondary, #b0b0b0);
    border: 1px solid var(--border-color, #333);
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .secondary-btn:hover {
    background: var(--hover-bg, #333);
    color: var(--text-primary, #e0e0e0);
  }

  .nav-buttons {
    display: flex;
    justify-content: space-between;
    width: 100%;
    margin-top: 24px;
  }

  .folder-options {
    display: flex;
    gap: 12px;
    width: 100%;
    margin-bottom: 16px;
  }

  .folder-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 20px 16px;
    background: var(--bg-tertiary, #2d2d2d);
    border: 1px solid var(--border-color, #333);
    border-radius: 8px;
    color: var(--text-primary, #e0e0e0);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }

  .folder-btn:hover {
    border-color: var(--accent-color, #0078d4);
    background: var(--hover-bg, #333);
  }

  .folder-btn-label {
    font-size: 13px;
    font-weight: 500;
  }

  .folder-btn-hint {
    font-size: 11px;
    color: var(--text-muted, #888);
  }

  .claude-check {
    width: 100%;
    margin-bottom: 8px;
  }

  .check-result {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
  }

  .check-result.success {
    color: var(--success-color, #4ec9b0);
    background: rgba(78, 201, 176, 0.1);
  }

  .check-result.warning {
    color: var(--warning-color, #cca700);
    background: rgba(204, 167, 0, 0.1);
  }

  .check-result.checking {
    color: var(--text-secondary, #b0b0b0);
  }

  .check-result :global(.spin-icon) {
    animation: onboard-spin 0.8s linear infinite;
  }

  @keyframes onboard-spin {
    to { transform: rotate(360deg); }
  }

  .install-hint {
    margin: 8px 0 12px;
    font-size: 13px;
    color: var(--text-secondary, #b0b0b0);
  }

  .install-hint a {
    color: var(--accent-color, #0078d4);
    text-decoration: underline;
  }

  .check-again {
    margin: 0 auto;
  }

  .markers-grid {
    width: 100%;
    text-align: left;
    margin-bottom: 16px;
  }

  .marker-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 0;
    font-size: 13px;
    color: var(--text-primary, #e0e0e0);
  }

  .marker-row kbd {
    display: inline-block;
    min-width: 28px;
    padding: 2px 8px;
    font-family: var(--font-mono, monospace);
    font-size: 12px;
    color: var(--text-primary, #e0e0e0);
    background: var(--bg-tertiary, #2d2d2d);
    border: 1px solid var(--border-color, #333);
    border-radius: 4px;
    text-align: center;
  }

  .tips-shortcuts {
    width: 100%;
    text-align: left;
    border-top: 1px solid var(--border-color, #333);
    padding-top: 12px;
  }

  .tips-shortcuts p {
    margin: 6px 0;
    font-size: 13px;
    color: var(--text-secondary, #b0b0b0);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .tips-shortcuts kbd {
    display: inline-block;
    padding: 2px 6px;
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    color: var(--text-primary, #e0e0e0);
    background: var(--bg-tertiary, #2d2d2d);
    border: 1px solid var(--border-color, #333);
    border-radius: 3px;
    white-space: nowrap;
  }
</style>
