import { spawn, type IPty } from 'tauri-pty';
import { getInvoke } from '$lib/utils/tauri';

/**
 * Get the default shell from the system (via Tauri command)
 */
export async function getDefaultShell(): Promise<{ command: string; args: string[] }> {
  try {
    const invoke = await getInvoke();
    const shell = await invoke<string>('get_default_shell');

    // Use -i for interactive shell (enables prompt, history, etc.)
    // PowerShell doesn't support -i; use -NoExit to keep session open
    const isPowerShell = shell.toLowerCase().includes('powershell');
    return { command: shell, args: isPowerShell ? ['-NoExit'] : ['-i'] };
  } catch {
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
    name: 'xterm-256color', // Sets TERM environment variable for proper line editing
    cols: options.cols,
    rows: options.rows,
    cwd: options.cwd,
  });
}

export type { IPty as Pty };
