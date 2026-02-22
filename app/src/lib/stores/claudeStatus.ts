import { writable } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export const claudeInstalled = writable<boolean>(false);

export async function checkClaudeInstalled(): Promise<boolean> {
  try {
    const installed = await invoke<boolean>('check_claude_installed');
    claudeInstalled.set(installed);
    return installed;
  } catch {
    claudeInstalled.set(false);
    return false;
  }
}

// Auto-check on module load
if (typeof window !== 'undefined') {
  checkClaudeInstalled();
}
