import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs/promises";
import * as path from "path";
import {
  getCurrentFile,
  getWorkspacePath,
  sendPush,
  isConnected,
} from "../websocket/client.js";
import { parseMarkers } from "../processing/parser.js";
import { buildPrompt, ProcessingStyle } from "../processing/prompt-builder.js";
import { CONFIG } from "../config.js";

const anthropic = new Anthropic();

/**
 * Validate that a resolved path stays within the workspace
 */
function validateWorkspacePath(workspace: string, target: string): string {
  const resolved = path.resolve(workspace, target);
  const normalized = path.normalize(resolved);

  if (!normalized.startsWith(workspace + path.sep) && normalized !== workspace) {
    throw new Error("Path must be within workspace");
  }

  return normalized;
}

export interface ProcessMeetingInput {
  path: string; // 'current' or relative path
  style?: ProcessingStyle;
  focus?: string;
}

export interface ProcessMeetingResult {
  success: boolean;
  message: string;
  title?: string;
  style?: string;
  tokens?: { input: number; output: number; cache_read?: number; cache_creation?: number };
}

/**
 * Call Claude API with retry logic for rate limits and connection errors
 */
async function callClaudeWithRetry(
  params: Anthropic.MessageCreateParamsNonStreaming,
  maxRetries = 3,
): Promise<Anthropic.Message> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await anthropic.messages.create(params);
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError && attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
        console.error(`Rate limited, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      if (error instanceof Anthropic.APIConnectionError && attempt < maxRetries) {
        const delay = 1000 * Math.pow(2, attempt);
        console.error(`Connection error, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
}

/**
 * Process raw meeting notes into a structured summary
 */
export async function processMeeting(
  input: ProcessMeetingInput
): Promise<ProcessMeetingResult> {
  // 1. Resolve the file path and get content
  let content: string;
  let filePath: string;
  let relativePath: string;
  let workspacePath: string;

  if (input.path === "current") {
    if (!isConnected()) {
      throw new Error(
        "Not connected to Chronicle app. Is Chronicle running?"
      );
    }
    const current = await getCurrentFile();
    if (!current.path || !current.content) {
      throw new Error(
        "No note currently open in Chronicle. Open a note first."
      );
    }
    content = current.content;
    filePath = current.path;
    relativePath = current.relativePath || path.basename(filePath);

    const wsPath = await getWorkspacePath();
    if (!wsPath) {
      throw new Error("No workspace open in Chronicle");
    }
    workspacePath = wsPath;

    // Validate that the current file path is within workspace
    validateWorkspacePath(workspacePath, relativePath);
  } else {
    const wsPath = await getWorkspacePath();
    if (!wsPath) {
      throw new Error("No workspace open in Chronicle");
    }
    workspacePath = wsPath;

    // Validate the user-provided path before any file operations
    filePath = validateWorkspacePath(workspacePath, input.path);
    relativePath = input.path;
    content = await fs.readFile(filePath, "utf-8");
  }

  // 2. Parse markers
  const parsedMarkers = parseMarkers(content);

  // 3. Build prompt
  const style = input.style || "standard";
  const { system, user } = buildPrompt(
    content,
    parsedMarkers,
    style,
    undefined,
    input.focus
  );

  // 4. Token estimate check
  const estimatedInputTokens = Math.ceil((system.length + user.length) / 4);
  if (estimatedInputTokens > 150000) {
    throw new Error(
      `Note is very large (~${estimatedInputTokens} estimated tokens). ` +
      `Consider using 'brief' style or splitting the note.`
    );
  }

  // 5. Call Claude API with prompt caching and retry logic
  let response: Anthropic.Message;
  try {
    response = await callClaudeWithRetry({
      model: CONFIG.model,
      max_tokens: CONFIG.maxTokens,
      system: [
        {
          type: "text" as const,
          text: system,
          cache_control: { type: "ephemeral" as const }
        }
      ],
      messages: [{ role: "user", content: user }],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      throw new Error("Invalid API key. Check your ANTHROPIC_API_KEY environment variable.");
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new Error("Rate limited after retries. Please wait a moment and try again.");
    }
    if (error instanceof Anthropic.APIConnectionError) {
      throw new Error("Cannot reach Claude API. Check your internet connection.");
    }
    if (error instanceof Anthropic.BadRequestError) {
      throw new Error("Input too large or invalid. Try using 'brief' processing style.");
    }
    throw error;
  }

  const processedContent = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  // 6. Save raw backup if it doesn't exist
  const rawDir = path.join(workspacePath, ".raw");
  const baseName = path.basename(filePath, ".md");
  const rawPath = path.join(rawDir, `${baseName}.raw.md`);

  try {
    await fs.access(rawPath);
    // Raw backup already exists, don't overwrite
  } catch {
    // Raw backup doesn't exist, create it
    await fs.mkdir(rawDir, { recursive: true });
    await fs.writeFile(rawPath, content, "utf-8");
  }

  // 7. Write processed content to main file
  await fs.writeFile(filePath, processedContent, "utf-8");

  // 8. Update metadata
  const metaDir = path.join(workspacePath, ".meta");
  const metaPath = path.join(metaDir, `${baseName}.json`);
  await fs.mkdir(metaDir, { recursive: true });

  // Load existing meta or create new
  let existingMeta: Record<string, unknown> = {};
  try {
    const existingContent = await fs.readFile(metaPath, "utf-8");
    existingMeta = JSON.parse(existingContent);
  } catch {
    // No existing meta, start fresh
  }

  const processingMeta = {
    processed_at: new Date().toISOString(),
    style,
    model: CONFIG.model,
    tokens_used: {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
      cache_read: (response.usage as any).cache_read_input_tokens || 0,
      cache_creation: (response.usage as any).cache_creation_input_tokens || 0,
    },
    markers_found: {
      thoughts: parsedMarkers.thoughts.length,
      important: parsedMarkers.important.length,
      questions: parsedMarkers.questions.length,
      actions: parsedMarkers.actions.length,
      attributions: parsedMarkers.attributions.length,
    },
  };

  const updatedMeta = { ...existingMeta, processing: processingMeta };
  await fs.writeFile(metaPath, JSON.stringify(updatedMeta, null, 2), "utf-8");

  // 9. Push result to Chronicle app
  sendPush("processingComplete", {
    path: relativePath,
    result: {
      summary: processedContent.slice(0, 500),
      style,
      tokens: response.usage,
    },
  });

  // 10. Extract title from original content
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : relativePath;

  return {
    success: true,
    message: `Processed note: ${title}

Summary generated with style: ${style}
Tokens used: ${response.usage.input_tokens} input, ${response.usage.output_tokens} output

Results saved to ${relativePath} and displayed in Chronicle AI Output pane.`,
    title,
    style,
    tokens: {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
    },
  };
}
