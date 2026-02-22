import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerResources } from "./resources/index.js";
import { registerTools } from "./tools/index.js";
import { tryConnect, isConnected, setRequestHandler, sendPush } from "./websocket/client.js";
import { processMeeting } from "./tools/process.js";
import type { ProcessingStyle } from "./processing/prompt-builder.js";

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

// Handle incoming requests from the Chronicle app (e.g., triggerProcessing)
function setupRequestHandler(): void {
  setRequestHandler(async (method: string, data: unknown) => {
    if (method === "triggerProcessing") {
      console.error("Received triggerProcessing request from Chronicle app");

      const requestData = data as { style?: string } | undefined;
      const style = (requestData?.style || "standard") as ProcessingStyle;

      // Acknowledge immediately so the frontend knows we're processing
      sendPush("processingStarted", { style });

      try {
        const result = await processMeeting({
          path: "current",
          style,
        });
        console.error(`Processing complete: ${result.message}`);
        // Note: processMeeting already sends processingComplete push internally
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.error(`Processing failed: ${errorMsg}`);
        // Send error push so the app can update UI
        sendPush("processingError", { error: errorMsg });
      }
    } else {
      console.error(`Unknown request method from app: ${method}`);
    }
  });
}

async function main() {
  // Try to connect to Chronicle app (non-blocking)
  console.error("Chronicle MCP Server starting...");
  await tryConnect();

  // Set up handler for incoming requests from the app
  setupRequestHandler();

  // Start MCP server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Chronicle MCP Server started");
}

main().catch(console.error);
