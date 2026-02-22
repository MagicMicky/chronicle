import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getHistory, getVersion, compareVersions } from "./history.js";

// Schema for get_history tool
const getHistorySchema = {
  path: z.string().max(4096).describe(
    "Path to note file relative to workspace, or 'current' for the active file"
  ),
  limit: z.number().optional().default(10).describe(
    "Maximum number of commits to return"
  ),
};

// Schema for get_version tool
const getVersionSchema = {
  path: z.string().max(4096).describe("Path to note file relative to workspace"),
  commit: z.string().max(256).describe(
    "Commit hash (short or full) or relative ref (HEAD~1, HEAD~2)"
  ),
};

// Schema for compare_versions tool
const compareVersionsSchema = {
  path: z.string().max(4096).describe("Path to note file relative to workspace"),
  from_commit: z.string().max(256).optional().default("HEAD~1").describe(
    "Starting commit (older)"
  ),
  to_commit: z.string().max(256).optional().default("HEAD").describe(
    "Ending commit (newer)"
  ),
};

export function registerTools(server: McpServer) {
  // Register get_history tool
  server.tool(
    "get_history",
    getHistorySchema,
    {
      title: "Get Note History",
      readOnlyHint: true,
    },
    async (args) => {
      try {
        const result = await getHistory({
          path: args.path,
          limit: args.limit,
        });
        return {
          content: [{ type: "text", text: result }],
        };
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text", text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // Register get_version tool
  server.tool(
    "get_version",
    getVersionSchema,
    {
      title: "Get Note Version",
      readOnlyHint: true,
    },
    async (args) => {
      try {
        const result = await getVersion({
          path: args.path,
          commit: args.commit,
        });
        return {
          content: [{ type: "text", text: result }],
        };
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text", text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // Register compare_versions tool
  server.tool(
    "compare_versions",
    compareVersionsSchema,
    {
      title: "Compare Note Versions",
      readOnlyHint: true,
    },
    async (args) => {
      try {
        const result = await compareVersions({
          path: args.path,
          from_commit: args.from_commit,
          to_commit: args.to_commit,
        });
        return {
          content: [{ type: "text", text: result }],
        };
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text", text: `Error: ${error}` }],
          isError: true,
        };
      }
    }
  );
}
