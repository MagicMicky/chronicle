import WebSocket from "ws";
import type {
  WsRequest,
  WsResponse,
  WsPush,
  CurrentFileResult,
  WorkspacePathResult,
} from "./messages.js";

const WS_PORT = process.env.CHRONICLE_WS_PORT || "9847";
const WS_URL = `ws://127.0.0.1:${WS_PORT}`;

let ws: WebSocket | null = null;
let requestId = 0;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 60000;

const pendingRequests = new Map<
  string,
  { resolve: (value: unknown) => void; reject: (error: Error) => void }
>();

let pushHandler: ((event: string, data: unknown) => void) | null = null;

export function setPushHandler(
  handler: (event: string, data: unknown) => void
): void {
  pushHandler = handler;
}

export async function connect(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      ws = new WebSocket(WS_URL);

      ws.on("open", () => {
        console.error("Connected to Chronicle app");
        reconnectAttempts = 0;
        resolve();
      });

      ws.on("message", (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString()) as WsResponse | WsPush;

          if (msg.type === "response" && pendingRequests.has(msg.id)) {
            const pending = pendingRequests.get(msg.id)!;
            pendingRequests.delete(msg.id);
            pending.resolve(msg.result);
          } else if (msg.type === "push" && pushHandler) {
            pushHandler((msg as WsPush).event, (msg as WsPush).data);
          }
        } catch (e) {
          console.error("Failed to parse WebSocket message:", e);
        }
      });

      ws.on("close", () => {
        console.error("Disconnected from Chronicle app");
        ws = null;
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
    } catch (e) {
      // Will retry on next close event
    }
  }, delay);
}

export function isConnected(): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN;
}

export function disconnect(): void {
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

    // Timeout after 30 seconds
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error("Request timeout"));
      }
    }, 30000);
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
    console.error("Cannot send push: not connected to Chronicle app");
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
