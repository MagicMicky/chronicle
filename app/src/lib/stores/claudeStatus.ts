import { writable } from 'svelte/store';
import { isTauri, getInvoke } from '$lib/utils/tauri';

export const claudeInstalled = writable<boolean>(false);

export async function checkClaudeInstalled(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const invoke = await getInvoke();
    const installed = await invoke<boolean>('check_claude_installed');
    claudeInstalled.set(installed);
    return installed;
  } catch {
    claudeInstalled.set(false);
    return false;
  }
}
