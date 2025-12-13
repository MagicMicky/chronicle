import { open } from '@tauri-apps/plugin-dialog';

/**
 * Open a native folder picker dialog
 * @returns The selected folder path, or null if cancelled
 */
export async function pickFolder(): Promise<string | null> {
  try {
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Select Workspace Folder',
    });
    return selected as string | null;
  } catch (e) {
    console.error('Folder picker failed:', e);
    return null;
  }
}
