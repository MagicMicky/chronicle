import { spawn, type IPty } from 'tauri-pty';
import { getInvoke } from '$lib/utils/tauri';

/**
 * Get the default shell from the system (via Tauri command)
 */
export async function getDefaultShell(): Promise<{ command: string; args: string[] }> {
  try {
    const invoke = await getInvoke();
    const shell = await invoke<string>('get_default_shell');
    console.log('[PTY] Using shell from environment:', shell);

    // Use -i for interactive shell (enables prompt, history, etc.)
    return { command: shell, args: ['-i'] };
  } catch (e) {
    console.warn('[PTY] Failed to get shell from env, using fallback:', e);
    // Fallback
    const platform = navigator.platform.toLowerCase();
    if (platform.includes('win')) {
      return { command: 'powershell.exe', args: [] };
    }
    return { command: '/bin/sh', args: ['-i'] };
  }
}

export interface PtyOptions {
  cols: number;
  rows: number;
  cwd: string;
}

/**
 * Spawn a PTY process with the default shell
 */
export async function spawnPty(options: PtyOptions): Promise<IPty> {
  const { command, args } = await getDefaultShell();

  return spawn(command, args, {
    cols: options.cols,
    rows: options.rows,
    cwd: options.cwd,
  });
}

export type { IPty as Pty };
