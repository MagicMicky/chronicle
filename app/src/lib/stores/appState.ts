import { getInvoke } from '$lib/utils/tauri';
import { aiOutputStore } from './aiOutput';

/**
 * Sync app state to the Rust backend for WebSocket handlers
 * This allows the MCP server to query current file and workspace
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

/**
 * Handle WebSocket push events from the backend
 * This is called when the MCP server sends updates (e.g., processingComplete)
 */
export function handleWsPush(event: string, data: unknown): void {
  switch (event) {
    case 'processingComplete':
      aiOutputStore.handleProcessingComplete(
        data as {
          path: string;
          result: {
            summary: string;
            style: string;
            tokens: { input_tokens: number; output_tokens: number };
          };
        }
      );
      break;
    case 'processingError':
      aiOutputStore.setError(
        (data as { path: string; error: string }).error
      );
      break;
    default:
      console.log('Unknown WebSocket push event:', event, data);
  }
}
