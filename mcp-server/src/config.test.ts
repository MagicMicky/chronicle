import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { loadConfig } from "./config";

describe("CONFIG", () => {
  const originalEnv: Record<string, string | undefined> = {};
  const envKeys = ["CHRONICLE_WORKSPACE"];

  beforeEach(() => {
    for (const key of envKeys) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (originalEnv[key] !== undefined) {
        process.env[key] = originalEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  it("returns default values when no env vars are set", () => {
    const config = loadConfig();
    expect(config.workspacePath).toBe("");
  });

  it("respects CHRONICLE_WORKSPACE env var", () => {
    process.env.CHRONICLE_WORKSPACE = "/tmp/my-notes";
    const config = loadConfig();
    expect(config.workspacePath).toBe("/tmp/my-notes");
  });
});
