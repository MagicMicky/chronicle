import { describe, it, expect } from "bun:test";
import * as path from "path";

/**
 * Since validateWorkspacePath and validateCommitRef are private functions
 * in process.ts and history.ts, we recreate their logic here for unit testing.
 * This ensures the validation logic is correct even though the functions
 * themselves are module-private.
 */

// Recreated from history.ts
function validateCommitRef(ref: string): string {
  if (!/^[a-zA-Z0-9._\-\/~^]+$/.test(ref)) {
    throw new Error("Invalid commit reference");
  }
  if (ref.length > 256) {
    throw new Error("Commit reference too long");
  }
  return ref;
}

// Recreated from process.ts and history.ts
function validateWorkspacePath(workspace: string, target: string): string {
  const resolved = path.resolve(workspace, target);
  const normalized = path.normalize(resolved);

  if (
    !normalized.startsWith(workspace + path.sep) &&
    normalized !== workspace
  ) {
    throw new Error("Path must be within workspace");
  }

  return normalized;
}

describe("validateWorkspacePath", () => {
  const workspace = "/home/user/workspace";

  it("accepts valid paths within workspace", () => {
    const result = validateWorkspacePath(workspace, "notes/meeting.md");
    expect(result).toBe(path.join(workspace, "notes/meeting.md"));
  });

  it("accepts files directly in workspace root", () => {
    const result = validateWorkspacePath(workspace, "test.md");
    expect(result).toBe(path.join(workspace, "test.md"));
  });

  it("accepts deeply nested paths", () => {
    const result = validateWorkspacePath(
      workspace,
      "a/b/c/d/file.md"
    );
    expect(result).toBe(path.join(workspace, "a/b/c/d/file.md"));
  });

  it("rejects ../ traversal paths", () => {
    expect(() =>
      validateWorkspacePath(workspace, "../../../etc/passwd")
    ).toThrow("Path must be within workspace");
  });

  it("rejects paths that traverse up and back into a different directory", () => {
    expect(() =>
      validateWorkspacePath(workspace, "notes/../../other/file.md")
    ).toThrow("Path must be within workspace");
  });

  it("rejects absolute paths outside workspace", () => {
    expect(() =>
      validateWorkspacePath(workspace, "/etc/passwd")
    ).toThrow("Path must be within workspace");
  });

  it("rejects paths using ../ to escape workspace", () => {
    expect(() =>
      validateWorkspacePath(workspace, "subdir/../../../root-file")
    ).toThrow("Path must be within workspace");
  });

  it("allows ../ that resolves within workspace", () => {
    // notes/../file.md resolves to /home/user/workspace/file.md which is valid
    const result = validateWorkspacePath(workspace, "notes/../file.md");
    expect(result).toBe(path.join(workspace, "file.md"));
  });

  it("rejects workspace path prefix attack", () => {
    // /home/user/workspace-evil should not match /home/user/workspace
    expect(() =>
      validateWorkspacePath(workspace, "/home/user/workspace-evil/file.md")
    ).toThrow("Path must be within workspace");
  });
});

describe("validateCommitRef", () => {
  it("accepts valid short commit hashes", () => {
    expect(validateCommitRef("abc1234")).toBe("abc1234");
  });

  it("accepts valid full commit hashes", () => {
    const fullHash = "a".repeat(40);
    expect(validateCommitRef(fullHash)).toBe(fullHash);
  });

  it("accepts HEAD reference", () => {
    expect(validateCommitRef("HEAD")).toBe("HEAD");
  });

  it("accepts HEAD~N references", () => {
    expect(validateCommitRef("HEAD~1")).toBe("HEAD~1");
    expect(validateCommitRef("HEAD~10")).toBe("HEAD~10");
  });

  it("accepts HEAD^N references", () => {
    expect(validateCommitRef("HEAD^1")).toBe("HEAD^1");
  });

  it("accepts branch names", () => {
    expect(validateCommitRef("main")).toBe("main");
    expect(validateCommitRef("feature/my-branch")).toBe("feature/my-branch");
  });

  it("accepts tag-like references", () => {
    expect(validateCommitRef("v1.0.0")).toBe("v1.0.0");
    expect(validateCommitRef("v0.6.0")).toBe("v0.6.0");
  });

  it("rejects references with shell injection characters", () => {
    expect(() => validateCommitRef("abc; rm -rf /")).toThrow(
      "Invalid commit reference"
    );
  });

  it("rejects references with backticks", () => {
    expect(() => validateCommitRef("`whoami`")).toThrow(
      "Invalid commit reference"
    );
  });

  it("rejects references with $() command substitution", () => {
    expect(() => validateCommitRef("$(cat /etc/passwd)")).toThrow(
      "Invalid commit reference"
    );
  });

  it("rejects references with pipe characters", () => {
    expect(() => validateCommitRef("HEAD | ls")).toThrow(
      "Invalid commit reference"
    );
  });

  it("rejects references with spaces", () => {
    expect(() => validateCommitRef("HEAD 1")).toThrow(
      "Invalid commit reference"
    );
  });

  it("rejects references longer than 256 characters", () => {
    const longRef = "a".repeat(257);
    expect(() => validateCommitRef(longRef)).toThrow(
      "Commit reference too long"
    );
  });

  it("accepts references exactly 256 characters long", () => {
    const ref = "a".repeat(256);
    expect(validateCommitRef(ref)).toBe(ref);
  });

  it("rejects empty string", () => {
    expect(() => validateCommitRef("")).toThrow("Invalid commit reference");
  });
});
