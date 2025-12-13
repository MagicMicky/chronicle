import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getCurrentNoteResource, CURRENT_NOTE_URI } from "./current.js";
import { getConfigResource, CONFIG_URI } from "./config.js";

export function registerResources(server: McpServer) {
  // Register note://current resource
  server.resource(CURRENT_NOTE_URI, "Current Note", async () => {
    const resource = await getCurrentNoteResource();
    return { contents: [resource] };
  });

  // Register note://config resource
  server.resource(CONFIG_URI, "Chronicle Configuration", async () => {
    const resource = getConfigResource();
    return { contents: [resource] };
  });
}
