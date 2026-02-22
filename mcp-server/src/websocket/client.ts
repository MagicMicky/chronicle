import WebSocket from "ws";
import { z } from "zod";
import type {
  WsRequest,
  WsPush,
  CurrentFileResult,
  WorkspacePathResult,
} from "./messages.js";
import { CONFIG } from "../config.js";

const WS_URL = `ws://127.0.0.1:${CONFIG.wsPort}`;

let ws: WebSocket | null = null;
let requestId = 0;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 60000;

/** Inactivity timeout: if no messages received for 60s, proactively reconnect */
const INACTIVITY_TIMEOUT_MS = 60_000;
let inactivityTimer: ReturnType<typeof setTimeout> | null = null;

const pendingRequests = new Map<
  string,
  { resolve: (value: unknown) => void; reject: (error: Error) => void }
>();

/** Queue of push messages that failed to send while disconnected */
const pendingPushes: Array<{ event: string; data: unknown }> = [];

let pushHandler: ((event: string, data: unknown) => void) | null = null;
let requestHandler: ((method: string, data: unknown) => void) | null = null;

// Zod schemas for incoming WebSocket messages
const WsResponseSchema = z.object({
  type: z.literal("response"),
  id: z.string(),
  result: z.unknown().optional(),
  error: z.string().optional(),
});

const WsPushSchema = z.object({
  type: z.literal("push"),
  event: z.string(),
  data: z.unknown().optional(),
});

const WsIncomingRequestSchema = z.object({
  type: z.literal("request"),
  id: z.string(),
  method: z.string(),
  data: z.unknown().optional(),
});

const WsIncomingSchema = z.discriminatedUnion("type", [
  WsResponseSchema,
  WsPushSchema,
  WsIncomingRequestSchema,
]);

export function setPushHandler(
  handler: (event: string, data: unknown) => void
): void {
  pushHandler = handler;
}

export function setRequestHandler(
  handler: (method: string, data: unknown) => void
): void {
  requestHandler = handler;
}

function resetInactivityTimer(): void {
  if (inactivityTimer !== null) {
    clearTimeout(inactivityTimer);
  }
  inactivityTimer = setTimeout(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.error(
        "No messages received for 60s, reconnecting proactively..."
      );
      ws.close();
      // close event will trigger reconnect
    }
  }, INACTIVITY_TIMEOUT_MS);
}

function clearInactivityTimer(): void {
  if (inactivityTimer !== null) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
}

/** Flush any queued push messages after reconnecting */
function flushPendingPushes(): void {
  while (pendingPushes.length > 0) {
    const msg = pendingPushes.shift()!;
    if (isConnected()) {
      const push: WsPush = { type: "push", event: msg.event, data: msg.data };
      ws!.send(JSON.stringify(push));
      console.error(`Flushed queued push: ${msg.event}`);
    } else {
      // Put it back if we disconnected mid-flush
      pendingPushes.unshift(msg);
      break;
    }
  }
}

export async function connect(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      ws = new WebSocket(WS_URL);

      ws.on("open", () => {
        console.error("Connected to Chronicle app");
        reconnectAttempts = 0;
        resetInactivityTimer();
        flushPendingPushes();
        resolve();
      });

      ws.on("message", (data: WebSocket.Data) => {
        resetInactivityTimer();
        try {
          const raw = JSON.parse(data.toString());
          const parsed = WsIncomingSchema.safeParse(raw);

          if (!parsed.success) {
            console.error("Invalid WebSocket message:", parsed.error.message);
            return;
          }

          const msg = parsed.data;

          if (msg.type === "response" && pendingRequests.has(msg.id)) {
            const pending = pendingRequests.get(msg.id)!;
            pendingRequests.delete(msg.id);
            if (msg.error) {
              pending.reject(new Error(msg.error));
            } else {
              pending.resolve(msg.result);
            }
          } else if (msg.type === "push" && pushHandler) {
            pushHandler(msg.event, msg.data);
          } else if (msg.type === "request" && requestHandler) {
            requestHandler(msg.method, msg.data);
          }
        } catch (e) {
          console.error("Failed to parse WebSocket message:", e);
        }
      });

      ws.on("ping", () => {
        // ws library auto-responds with pong, just reset inactivity timer
        resetInactivityTimer();
      });

      ws.on("close", () => {
        console.error("Disconnected from Chronicle app");
        ws = null;
        clearInactivityTimer();
        // Attempt reconnect with exponential backoff
        scheduleReconnect();
      });

      ws.on("error", (error: Error) => {
        console.error("WebSocket error:", error.message);
        if (ws?.readyState !== WebSocket.OPEN) {
          reject(error);
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}

function scheduleReconnect(): void {
  const delay = Math.min(
    1000 * Math.pow(2, reconnectAttempts),
    MAX_RECONNECT_DELAY
  );
  reconnectAttempts++;

  console.error(`Reconnecting to Chronicle in ${delay / 1000}s...`);

  setTimeout(async () => {
    try {
      await connect();
    } catch {
      // Will retry on next close event
    }
  }, delay);
}

export function isConnected(): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN;
}

export function disconnect(): void {
  clearInactivityTimer();
  if (ws) {
    ws.close();
    ws = null;
  }
}

async function request<T>(
  method: string,
  params?: Record<string, unknown>
): Promise<T> {
  if (!isConnected()) {
    throw new Error("Not connected to Chronicle app");
  }

  const id = `req-${++requestId}`;
  const msg: WsRequest = { type: "request", id, method };
  if (params) {
    msg.params = params;
  }

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, {
      resolve: resolve as (value: unknown) => void,
      reject,
    });
    ws!.send(JSON.stringify(msg));

    // Timeout using configured value
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error("Request timeout"));
      }
    }, CONFIG.wsTimeout);
  });
}

export async function getCurrentFile(): Promise<CurrentFileResult> {
  return request<CurrentFileResult>("getCurrentFile");
}

export async function getWorkspacePath(): Promise<string | null> {
  const result = await request<WorkspacePathResult>("getWorkspacePath");
  return result.path;
}

export function sendPush(event: string, data: unknown): void {
  if (!isConnected()) {
    pendingPushes.push({ event, data });
    console.error(`Queued push (not connected): ${event}`);
    return;
  }

  const msg: WsPush = { type: "push", event, data };
  ws!.send(JSON.stringify(msg));
}

// Try to connect on module load, but don't fail if Chronicle isn't running
export async function tryConnect(): Promise<boolean> {
  try {
    await connect();
    return true;
  } catch {
    console.error(
      "Chronicle app not running. Will retry when processing notes."
    );
    return false;
  }
}
