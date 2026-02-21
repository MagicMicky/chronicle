import { describe, it, expect, beforeEach, afterEach } from "bun:test";

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

  // Since CONFIG is a module-level const, we need to re-import it each time
  // to test env var handling. We use dynamic import with cache busting.

  it("returns default values when no env vars are set", async () => {
    // Clear module cache and reimport
    delete require.cache[require.resolve("./config")];
    const { CONFIG } = await import("./config");

    expect(CONFIG.model).toBe("claude-sonnet-4-20250514");
    expect(CONFIG.maxTokens).toBe(4096);
    expect(CONFIG.wsPort).toBe(9847);
    expect(CONFIG.wsTimeout).toBe(30000);
  });

  it("respects CHRONICLE_MODEL env var", async () => {
    process.env.CHRONICLE_MODEL = "claude-opus-4-20250514";
    delete require.cache[require.resolve("./config")];
    const { CONFIG } = await import("./config");
    expect(CONFIG.model).toBe("claude-opus-4-20250514");
  });

  it("respects CHRONICLE_MAX_TOKENS env var", async () => {
    process.env.CHRONICLE_MAX_TOKENS = "8192";
    delete require.cache[require.resolve("./config")];
    const { CONFIG } = await import("./config");
    expect(CONFIG.maxTokens).toBe(8192);
  });

  it("respects CHRONICLE_WS_PORT env var", async () => {
    process.env.CHRONICLE_WS_PORT = "9999";
    delete require.cache[require.resolve("./config")];
    const { CONFIG } = await import("./config");
    expect(CONFIG.wsPort).toBe(9999);
  });

  it("respects CHRONICLE_WS_TIMEOUT env var", async () => {
    process.env.CHRONICLE_WS_TIMEOUT = "60000";
    delete require.cache[require.resolve("./config")];
    const { CONFIG } = await import("./config");
    expect(CONFIG.wsTimeout).toBe(60000);
  });

  it("falls back to default when numeric env vars are invalid", async () => {
    process.env.CHRONICLE_MAX_TOKENS = "not-a-number";
    delete require.cache[require.resolve("./config")];
    const { CONFIG } = await import("./config");
    // Number("not-a-number") is NaN, || 4096 will kick in
    expect(CONFIG.maxTokens).toBe(4096);
  });
});
