export function loadConfig() {
  return {
    workspacePath: process.env.CHRONICLE_WORKSPACE || "",
  } as const;
}

export const CONFIG = loadConfig();
