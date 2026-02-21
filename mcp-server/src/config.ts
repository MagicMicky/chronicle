export const CONFIG = {
  model: process.env.CHRONICLE_MODEL || "claude-sonnet-4-20250514",
  maxTokens: Number(process.env.CHRONICLE_MAX_TOKENS) || 4096,
  wsPort: Number(process.env.CHRONICLE_WS_PORT) || 9847,
  wsTimeout: Number(process.env.CHRONICLE_WS_TIMEOUT) || 30000,
} as const;
