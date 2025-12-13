import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerResources } from "./resources/index.js";
import { registerTools } from "./tools/index.js";
import { tryConnect, isConnected } from "./websocket/client.js";

const server = new McpServer({
  name: "chronicle",
  version: "0.5.0",
});

// Register resources (note://current, note://config)
registerResources(server);

// Register tools (process_meeting, etc.)
registerTools(server);

// Register a test/status tool
server.tool(
  "chronicle_status",
  {},
  {
    title: "Chronicle Status",
    readOnlyHint: true,
  },
  async () => {
    const connected = isConnected();
    return {
      content: [
        {
          type: "text",
          text: connected
            ? "Chronicle MCP server is operational and connected to Chronicle app."
            : "Chronicle MCP server is operational but NOT connected to Chronicle app. Make sure Chronicle is running.",
        },
      ],
    };
  }
);

async function main() {
  // Try to connect to Chronicle app (non-blocking)
  console.error("Chronicle MCP Server starting...");
  await tryConnect();

  // Start MCP server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Chronicle MCP Server started");
}

main().catch(console.error);
