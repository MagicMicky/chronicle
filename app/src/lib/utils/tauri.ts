/**
 * Check if running inside Tauri
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Safely get the Tauri invoke function.
 * Returns the real invoke when inside Tauri, or a no-op stub outside.
 */
export async function getInvoke() {
  if (!isTauri()) {
    // Return a stub that always rejects so callers' catch blocks fire gracefully
    return (async () => {
      throw new Error('Not running in Tauri');
    }) as unknown as typeof import('@tauri-apps/api/core').invoke;
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke;
}
