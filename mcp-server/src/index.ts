import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerResources } from "./resources/index.js";
import { registerTools } from "./tools/index.js";
import { loadState } from "./state.js";

const server = new McpServer({
  name: "chronicle",
  version: "0.7.0",
});

// Register resources (note://current, note://config)
registerResources(server);

// Register tools (history, etc.)
registerTools(server);

// Register a status tool
server.tool(
  "chronicle_status",
  {},
  {
    title: "Chronicle Status",
    readOnlyHint: true,
  },
  async () => {
    const state = loadState();
    const hasWorkspace = !!state?.workspacePath;
    const hasFile = !!state?.currentFile;
    return {
      content: [
        {
          type: "text",
          text: hasWorkspace
            ? `Chronicle MCP server is operational. Workspace: ${state!.workspacePath}${hasFile ? `, Current file: ${state!.currentFile}` : ""}`
            : "Chronicle MCP server is operational but no workspace is open. Open a workspace in Chronicle first.",
        },
      ],
    };
  }
);

async function main() {
  console.error("Chronicle MCP Server starting...");

  // Start MCP server with stdio transport (no WebSocket needed)
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Chronicle MCP Server started");
}

main().catch(console.error);
