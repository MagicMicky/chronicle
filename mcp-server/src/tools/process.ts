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

const anthropic = new Anthropic();

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
  tokens?: { input: number; output: number };
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
  } else {
    const wsPath = await getWorkspacePath();
    if (!wsPath) {
      throw new Error("No workspace open in Chronicle");
    }
    workspacePath = wsPath;
    filePath = path.join(workspacePath, input.path);
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

  // 4. Call Claude API
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: user }],
  });

  const processedContent = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  // 5. Save raw backup if it doesn't exist
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

  // 6. Write processed content to main file
  await fs.writeFile(filePath, processedContent, "utf-8");

  // 7. Update metadata
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
    model: "claude-sonnet-4-20250514",
    tokens_used: {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
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

  // 8. Push result to Chronicle app
  sendPush("processingComplete", {
    path: relativePath,
    result: {
      summary: processedContent.slice(0, 500),
      style,
      tokens: response.usage,
    },
  });

  // 9. Extract title from original content
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
