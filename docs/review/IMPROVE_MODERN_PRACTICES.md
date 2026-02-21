# Improvement Plan: Modern Practices

**Priority:** Medium-High
**Estimated Effort:** 4-6 days
**Impact:** Better UX during processing, lower API costs, more reliable output parsing, future-proofing

---

## Problem Summary

Chronicle's MCP server and Claude API integration use basic patterns from the early MCP era. The Anthropic SDK is current (v0.39.0), but the integration doesn't leverage structured output, prompt caching, streaming, batch processing, or tool use. These newer capabilities would improve reliability, reduce costs, and create a better user experience.

---

## 1. Implement Structured Output — HIGH

**Problem:** Chronicle calls Claude with a text prompt and parses the markdown response manually. This is fragile — if Claude changes formatting slightly, parsing breaks.

**Where:** `mcp-server/src/tools/process.ts`, `mcp-server/src/processing/prompt-builder.ts`

### Course of Action

#### Option A: Tool Use (Recommended)

Use Claude's tool calling to get structured JSON responses:

```typescript
const response = await anthropic.messages.create({
  model: CONFIG.model,
  max_tokens: CONFIG.maxTokens,
  system: systemPrompt,
  tools: [
    {
      name: "create_processed_output",
      description: "Create structured output from processed meeting notes",
      input_schema: {
        type: "object",
        properties: {
          tldr: {
            type: "string",
            description: "1-3 sentence summary of the meeting/notes"
          },
          key_points: {
            type: "array",
            items: { type: "string" },
            description: "Key points and takeaways"
          },
          action_items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                text: { type: "string" },
                owner: { type: "string" }
              },
              required: ["text"]
            },
            description: "Action items extracted from notes"
          },
          questions: {
            type: "array",
            items: { type: "string" },
            description: "Open questions that need follow-up"
          }
        },
        required: ["tldr", "key_points", "action_items", "questions"]
      }
    }
  ],
  tool_choice: { type: "tool", name: "create_processed_output" },
  messages: [{ role: "user", content: userPrompt }]
});

// Extract structured data from tool use response
const toolUse = response.content.find(block => block.type === "tool_use");
const structured = toolUse.input; // Already typed JSON
```

**Benefits:**
- Guaranteed JSON structure — no markdown parsing needed
- Type-safe at the API level
- Eliminates parsing bugs in `commands/file.rs:read_processed_file`

#### Option B: JSON Mode

If tool use feels heavyweight, use the simpler JSON response format (if supported by the SDK version).

**Migration path:**
1. Implement tool use in `process.ts`
2. Write structured JSON to the output file instead of markdown
3. Simplify `read_processed_file` in Rust to parse JSON directly
4. Keep markdown rendering in the frontend (render JSON → display components)
5. Maintain backward compatibility: detect old markdown files and parse them with existing logic

---

## 2. Add Prompt Caching — HIGH

**Problem:** Every processing call sends the same system prompt (instructions for how to process notes). This wastes tokens and adds latency.

**Where:** `mcp-server/src/tools/process.ts`

### Course of Action

Use Anthropic's prompt caching feature:

```typescript
const response = await anthropic.messages.create({
  model: CONFIG.model,
  max_tokens: CONFIG.maxTokens,
  system: [
    {
      type: "text",
      text: systemPrompt,
      cache_control: { type: "ephemeral" }
    }
  ],
  messages: [{ role: "user", content: userPrompt }]
});
```

**Benefits:**
- System prompt cached server-side for 5 minutes
- Subsequent calls within the window use cached tokens (90% cost reduction on cached portion)
- Lower latency for repeated processing
- Particularly valuable when processing multiple notes in a session

**Cost impact estimate:**
- System prompt is ~500-1000 tokens
- With caching, 2nd+ calls in 5min window save ~90% on those tokens
- If a user processes 5 notes in a session: ~20-30% total cost reduction

---

## 3. Add Streaming Responses — MEDIUM

**Problem:** Processing takes 5-15 seconds with no progress feedback. Users see a spinner but no indication of progress.

**Where:** `mcp-server/src/tools/process.ts`, `app/src-tauri/src/websocket/handlers.rs`, `app/src/lib/stores/aiOutput.ts`

### Course of Action

#### A. Stream from Claude API

```typescript
const stream = await anthropic.messages.stream({
  model: CONFIG.model,
  max_tokens: CONFIG.maxTokens,
  system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
  messages: [{ role: "user", content: userPrompt }]
});

// Send progress updates via WebSocket
for await (const event of stream) {
  if (event.type === "content_block_delta") {
    wsClient.sendPush("ai:processing-progress", {
      tokensGenerated: stream.currentMessage()?.usage?.output_tokens || 0,
    });
  }
}

const finalMessage = await stream.finalMessage();
```

#### B. Forward Progress via WebSocket

Add new push event `ai:processing-progress`:

```rust
// In websocket/handlers.rs
"ai:processing-progress" => {
    if let Some(handle) = &app_state.app_handle {
        handle.emit("ai:processing-progress", &push.data)
            .map_err(|e| format!("Emit error: {}", e))?;
    }
}
```

#### C. Display Progress in Frontend

```typescript
// In aiOutput.ts
listen('ai:processing-progress', (event) => {
  aiOutput.update(state => ({
    ...state,
    tokensGenerated: event.payload.tokensGenerated
  }));
});
```

Show in AI Output pane: "Processing... (234 tokens generated)"

---

## 4. Add Token Counting Before API Calls — MEDIUM

**Problem:** No pre-flight check on input size. Large notes could hit token limits or generate unexpected costs.

**Where:** `mcp-server/src/tools/process.ts`

### Course of Action

```typescript
import Anthropic from "@anthropic-ai/sdk";

// Before sending to API, estimate token count
const estimatedTokens = Math.ceil(userPrompt.length / 4); // Rough estimate

if (estimatedTokens > 100000) {
  // For very large notes, suggest brief style
  return {
    content: [{
      type: "text",
      text: `Note is very large (~${estimatedTokens} tokens). Consider using 'brief' style or splitting the note.`
    }],
    isError: true
  };
}

// Adjust max_tokens based on input size
const maxOutputTokens = Math.min(
  CONFIG.maxTokens,
  200000 - estimatedTokens - 1000 // Leave headroom
);
```

Also include token usage in processing metadata:
```typescript
metadata: {
  inputTokens: response.usage.input_tokens,
  outputTokens: response.usage.output_tokens,
  cacheReadTokens: response.usage.cache_read_input_tokens || 0,
  cacheCreationTokens: response.usage.cache_creation_input_tokens || 0,
  estimatedCost: calculateCost(response.usage),
}
```

---

## 5. Make Model Configurable — MEDIUM

**Problem:** Model is hardcoded to `claude-sonnet-4-20250514`. Users can't choose between speed (Haiku), balance (Sonnet), or quality (Opus).

**Where:** `mcp-server/src/tools/process.ts`, `mcp-server/src/config.ts`

### Course of Action

1. **Environment variable** for default model:
   ```typescript
   export const CONFIG = {
     model: process.env.CHRONICLE_MODEL || "claude-sonnet-4-20250514",
   };
   ```

2. **Tool parameter** for per-request override:
   ```typescript
   const processMeetingSchema = {
     path: z.string(),
     style: z.enum([...]).optional(),
     model: z.enum(["haiku", "sonnet", "opus"]).optional(),
   };
   ```

3. **Model mapping**:
   ```typescript
   const MODEL_MAP = {
     haiku: "claude-haiku-4-5-20251001",
     sonnet: "claude-sonnet-4-20250514",
     opus: "claude-opus-4-6",
   };
   ```

4. **UI dropdown** in status bar alongside processing style (Phase 2).

5. **Smart defaults**: Use Sonnet for standard/brief, Opus for detailed/structured.

---

## 6. Add Batch Processing — LOW

**Problem:** Processing notes one at a time is fine for real-time use, but end-of-day bulk processing wastes money at full price.

**Where:** New tool in `mcp-server/src/tools/`

### Course of Action

1. **New MCP tool**: `batch_process_notes`
   ```typescript
   server.tool("batch_process_notes", {
     paths: z.array(z.string()),
     style: z.enum([...]).optional(),
   }, async (input) => {
     // Use Anthropic Batch API for 50% cost reduction
     const batch = await anthropic.batches.create({
       requests: input.paths.map(path => ({
         custom_id: path,
         params: {
           model: CONFIG.model,
           max_tokens: CONFIG.maxTokens,
           system: systemPrompt,
           messages: [{ role: "user", content: buildUserPrompt(path) }]
         }
       }))
     });

     // Return batch ID for polling
     return { batchId: batch.id };
   });
   ```

2. **Polling for completion**: New tool `check_batch_status` to query batch results.

3. **Cost display**: Show "Saved X% with batch processing" in metadata.

---

## 7. Add API Error Handling with Retry — MEDIUM

**Problem:** Single API call attempt with no retry logic. Rate limits, transient errors, and timeouts cause immediate failure.

**Where:** `mcp-server/src/tools/process.ts`

### Course of Action

```typescript
async function callClaudeWithRetry(
  params: Anthropic.MessageCreateParams,
  maxRetries = 3,
): Promise<Anthropic.Message> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await anthropic.messages.create(params);
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) {
        const retryAfter = Number(error.headers?.["retry-after"]) || 30;
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          continue;
        }
      }

      if (error instanceof Anthropic.APIConnectionError && attempt < maxRetries) {
        await new Promise(resolve =>
          setTimeout(resolve, 1000 * Math.pow(2, attempt))
        );
        continue;
      }

      // Non-retryable error or max retries exceeded
      throw error;
    }
  }

  throw new Error("Max retries exceeded");
}
```

Handle specific error types with user-friendly messages:
- `RateLimitError` → "Rate limited. Retrying..."
- `AuthenticationError` → "Invalid API key. Check ANTHROPIC_API_KEY."
- `APIConnectionError` → "Cannot reach Claude API. Check your connection."
- `BadRequestError` → "Input too large or invalid. Try 'brief' style."

---

## 8. Improve CLAUDE.md with Modern Patterns — LOW

**Problem:** CLAUDE.md is excellent but could include guidance on newer features.

### Course of Action

Add sections for:

1. **Hook integration**: Document any Claude Code hooks the project uses or could use (pre-commit validation, post-tool-use checks).

2. **MCP testing guide**: How to test MCP tools interactively with Claude Code.

3. **Model selection guidance**: When to use different Claude models for different task types.

4. **Performance considerations**: Token budgets, caching expectations, batch processing thresholds.

---

## Migration Strategy

These improvements can be adopted incrementally:

### Phase 1: Quick Wins (1-2 days)
- Add prompt caching (minimal code change, immediate cost savings)
- Make model configurable via env var
- Add API retry logic

### Phase 2: Structured Output (2-3 days)
- Implement tool use for structured responses
- Update Rust file parser to handle JSON output
- Maintain backward compatibility with markdown files

### Phase 3: Streaming + Progress (2-3 days)
- Add streaming to Claude API calls
- Forward progress events via WebSocket
- Display progress in frontend

### Phase 4: Advanced (Future)
- Batch processing API
- Token counting and cost tracking
- Smart model selection based on input size/style

---

## Success Criteria

- [ ] System prompts use `cache_control: { type: "ephemeral" }` for prompt caching
- [ ] Processing output uses tool use for guaranteed JSON structure
- [ ] Model configurable via `CHRONICLE_MODEL` environment variable
- [ ] API calls retry up to 3 times on transient errors with backoff
- [ ] Large inputs are detected and user is warned before processing
- [ ] Token usage and estimated cost shown in processing metadata
- [ ] Streaming progress visible during processing (tokens generated counter)
