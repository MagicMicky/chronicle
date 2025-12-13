import { spawn, type IPty } from 'tauri-pty';

/**
 * Get the default shell for the current platform
 */
export function getDefaultShell(): { command: string; args: string[] } {
  const platform = navigator.platform.toLowerCase();

  if (platform.includes('win')) {
    // Windows: prefer PowerShell
    return { command: 'powershell.exe', args: [] };
  }

  // macOS/Linux: use bash with login shell
  // Note: $SHELL env var is not accessible from browser context
  return { command: '/bin/bash', args: ['-l'] };
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
  const { command, args } = getDefaultShell();

  return spawn(command, args, {
    cols: options.cols,
    rows: options.rows,
    cwd: options.cwd,
  });
}

export type { IPty as Pty };
