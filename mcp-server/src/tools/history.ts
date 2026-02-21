import { execFileSync } from "child_process";
import path from "path";
import {
  getWorkspacePath,
  getCurrentFile,
  isConnected,
} from "../websocket/client.js";

/**
 * Validate that a commit reference contains only safe characters
 */
function validateCommitRef(ref: string): string {
  if (!/^[a-zA-Z0-9._\-\/~^]+$/.test(ref)) {
    throw new Error("Invalid commit reference");
  }
  if (ref.length > 256) {
    throw new Error("Commit reference too long");
  }
  return ref;
}

/**
 * Validate that a resolved path stays within the workspace
 */
function validateWorkspacePath(workspace: string, target: string): string {
  const resolved = path.resolve(workspace, target);
  const normalized = path.normalize(resolved);

  if (!normalized.startsWith(workspace + path.sep) && normalized !== workspace) {
    throw new Error("Path must be within workspace");
  }

  return normalized;
}

/**
 * Resolve a file path from input, handling 'current' specially
 */
async function resolveFilePath(
  inputPath: string
): Promise<{ workspacePath: string; relativePath: string }> {
  const workspacePath = await getWorkspacePath();
  if (!workspacePath) {
    throw new Error("No workspace open in Chronicle");
  }

  if (inputPath === "current") {
    if (!isConnected()) {
      throw new Error("Not connected to Chronicle app");
    }
    const current = await getCurrentFile();
    if (!current.relativePath) {
      throw new Error("No note currently open in Chronicle");
    }
    // Validate even the 'current' path
    validateWorkspacePath(workspacePath, current.relativePath);
    return { workspacePath, relativePath: current.relativePath };
  }

  // Validate the user-provided path
  validateWorkspacePath(workspacePath, inputPath);
  return { workspacePath, relativePath: inputPath };
}

export interface GetHistoryInput {
  path: string;
  limit?: number;
}

export async function getHistory(input: GetHistoryInput): Promise<string> {
  const { workspacePath, relativePath } = await resolveFilePath(input.path);
  const limit = Math.min(Math.max(Number(input.limit) || 10, 1), 100);

  try {
    const result = execFileSync(
      "git",
      [
        "log",
        "--pretty=format:%h|%s|%ar",
        "-n", String(limit),
        "--", relativePath,
      ],
      { cwd: workspacePath, encoding: "utf-8" }
    );

    if (!result.trim()) {
      return `No git history found for ${relativePath}. The file may not have been committed yet.`;
    }

    const commits = result
      .trim()
      .split("\n")
      .map((line, i) => {
        const [hash, message, time] = line.split("|");
        return `${i + 1}. ${message} (${hash}) - ${time}`;
      });

    return `History for ${relativePath}:\n\n${commits.join("\n")}\n\nUse get_version to view a specific version.`;
  } catch (e) {
    throw new Error(
      `Failed to get git history: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

export interface GetVersionInput {
  path: string;
  commit: string;
}

export async function getVersion(input: GetVersionInput): Promise<string> {
  const { workspacePath, relativePath } = await resolveFilePath(input.path);
  const commit = validateCommitRef(input.commit);

  try {
    // Get commit message
    const commitInfo = execFileSync(
      "git",
      ["log", "-1", "--pretty=format:%s", commit],
      { cwd: workspacePath, encoding: "utf-8" }
    ).trim();

    // Get file content at that commit
    const content = execFileSync(
      "git",
      ["show", `${commit}:${relativePath}`],
      { cwd: workspacePath, encoding: "utf-8" }
    );

    return `Version from commit ${commit} (${commitInfo}):\n\n${content}`;
  } catch (e) {
    throw new Error(
      `Failed to get version: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

export interface CompareVersionsInput {
  path: string;
  from_commit?: string;
  to_commit?: string;
}

export async function compareVersions(
  input: CompareVersionsInput
): Promise<string> {
  const { workspacePath, relativePath } = await resolveFilePath(input.path);
  const fromCommit = validateCommitRef(input.from_commit || "HEAD~1");
  const toCommit = validateCommitRef(input.to_commit || "HEAD");

  try {
    const diff = execFileSync(
      "git",
      ["diff", `${fromCommit}..${toCommit}`, "--", relativePath],
      { cwd: workspacePath, encoding: "utf-8" }
    );

    if (!diff.trim()) {
      return `No differences between ${fromCommit} and ${toCommit} for ${relativePath}`;
    }

    return `Diff for ${relativePath} (${fromCommit}..${toCommit}):\n\n\`\`\`diff\n${diff}\`\`\``;
  } catch (e) {
    throw new Error(
      `Failed to compare versions: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}
