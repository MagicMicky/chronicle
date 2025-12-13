import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { processMeeting } from "./process.js";
import { getHistory, getVersion, compareVersions } from "./history.js";

// Schema for process_meeting tool
const processMeetingSchema = {
  path: z.string().describe(
    "Path to note file relative to workspace, or 'current' for the active file in Chronicle"
  ),
  style: z
    .enum(["standard", "brief", "detailed", "focused", "structured"])
    .optional()
    .default("standard")
    .describe(
      "Processing style: standard (balanced), brief (essentials only), detailed (full context), focused (1:1 meetings), structured (compliance/audit)"
    ),
  focus: z
    .string()
    .optional()
    .describe(
      "Optional specific aspect to emphasize (e.g., 'action items only', 'timeline gaps')"
    ),
};

// Schema for get_history tool
const getHistorySchema = {
  path: z.string().describe(
    "Path to note file relative to workspace, or 'current' for the active file"
  ),
  limit: z.number().optional().default(10).describe(
    "Maximum number of commits to return"
  ),
};

// Schema for get_version tool
const getVersionSchema = {
  path: z.string().describe("Path to note file relative to workspace"),
  commit: z.string().describe(
    "Commit hash (short or full) or relative ref (HEAD~1, HEAD~2)"
  ),
};

// Schema for compare_versions tool
const compareVersionsSchema = {
  path: z.string().describe("Path to note file relative to workspace"),
  from_commit: z.string().optional().default("HEAD~1").describe(
    "Starting commit (older)"
  ),
  to_commit: z.string().optional().default("HEAD").describe(
    "Ending commit (newer)"
  ),
};

export function registerTools(server: McpServer) {
  // Register process_meeting tool
  server.tool(
    "process_meeting",
    processMeetingSchema,
    {
      title: "Process Meeting Notes",
      readOnlyHint: false,
      destructiveHint: false,
    },
    async (args) => {
      try {
        const result = await processMeeting({
          path: args.path,
          style: args.style,
          focus: args.focus,
        });
        return {
          content: [{ type: "text", text: result.message }],
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
