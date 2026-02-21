import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { loadConfig } from "./config";

describe("CONFIG", () => {
  // Save original env values
  const originalEnv: Record<string, string | undefined> = {};
  const envKeys = [
    "CHRONICLE_MODEL",
    "CHRONICLE_MAX_TOKENS",
    "CHRONICLE_WS_PORT",
    "CHRONICLE_WS_TIMEOUT",
  ];

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
    expect(config.model).toBe("claude-sonnet-4-20250514");
    expect(config.maxTokens).toBe(4096);
    expect(config.wsPort).toBe(9847);
    expect(config.wsTimeout).toBe(30000);
  });

  it("respects CHRONICLE_MODEL env var", () => {
    process.env.CHRONICLE_MODEL = "claude-opus-4-20250514";
    const config = loadConfig();
    expect(config.model).toBe("claude-opus-4-20250514");
  });

  it("respects CHRONICLE_MAX_TOKENS env var", () => {
    process.env.CHRONICLE_MAX_TOKENS = "8192";
    const config = loadConfig();
    expect(config.maxTokens).toBe(8192);
  });

  it("respects CHRONICLE_WS_PORT env var", () => {
    process.env.CHRONICLE_WS_PORT = "9999";
    const config = loadConfig();
    expect(config.wsPort).toBe(9999);
  });

  it("respects CHRONICLE_WS_TIMEOUT env var", () => {
    process.env.CHRONICLE_WS_TIMEOUT = "60000";
    const config = loadConfig();
    expect(config.wsTimeout).toBe(60000);
  });

  it("falls back to default when numeric env vars are invalid", () => {
    process.env.CHRONICLE_MAX_TOKENS = "not-a-number";
    const config = loadConfig();
    // Number("not-a-number") is NaN, || 4096 will kick in
    expect(config.maxTokens).toBe(4096);
  });
});
