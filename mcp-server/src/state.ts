import * as fs from "fs";
import * as path from "path";
import { loadConfig } from "./config.js";

export interface ChronicleState {
  workspacePath: string;
  currentFile: string | null;
  lastEdited: string;
  noteCount: number;
}

/**
 * Load the Chronicle state from .chronicle/state.json
 * Looks in the workspace path specified by config, or searches common locations.
 */
export function loadState(): ChronicleState | null {
  const config = loadConfig();

  // If a workspace path is configured, look there
  if (config.workspacePath) {
    const statePath = path.join(config.workspacePath, ".chronicle", "state.json");
    return readStateFile(statePath);
  }

  // Otherwise, try reading from common locations or environment
  const envWorkspace = process.env.CHRONICLE_WORKSPACE;
  if (envWorkspace) {
    const statePath = path.join(envWorkspace, ".chronicle", "state.json");
    return readStateFile(statePath);
  }

  return null;
}

/**
 * Get the workspace path from state
 */
export function getWorkspacePath(): string | null {
  const state = loadState();
  return state?.workspacePath ?? null;
}

/**
 * Get the current file path (relative) from state
 */
export function getCurrentFilePath(): string | null {
  const state = loadState();
  return state?.currentFile ?? null;
}

function readStateFile(statePath: string): ChronicleState | null {
  try {
    const content = fs.readFileSync(statePath, "utf-8");
    return JSON.parse(content) as ChronicleState;
  } catch {
    return null;
  }
}
