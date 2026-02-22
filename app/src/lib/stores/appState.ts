import { getInvoke } from '$lib/utils/tauri';

/**
 * Sync app state to the Rust backend
 * This writes .chronicle/state.json for the MCP server to read
 */
export async function syncAppState(options: {
  filePath?: string | null;
  fileContent?: string | null;
  workspacePath?: string | null;
}): Promise<void> {
  try {
    const invoke = await getInvoke();
    await invoke('update_app_state', {
      filePath: options.filePath ?? null,
      fileContent: options.fileContent ?? null,
      workspacePath: options.workspacePath ?? null,
    });
  } catch (e) {
    console.error('Failed to sync app state:', e);
  }
}
