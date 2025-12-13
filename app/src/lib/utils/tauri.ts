/**
 * Safely get the Tauri invoke function.
 * Uses dynamic import to avoid issues when Tauri internals aren't ready.
 */
export async function getInvoke() {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke;
}

/**
 * Check if running inside Tauri
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
