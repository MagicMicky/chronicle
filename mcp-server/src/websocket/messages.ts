export interface WsRequest {
  type: "request";
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

export interface WsResponse {
  type: "response";
  id: string;
  result: unknown;
  error?: string;
}

export interface WsPush {
  type: "push";
  event: string;
  data: unknown;
}

export type WsMessage = WsRequest | WsResponse | WsPush;

export interface CurrentFileResult {
  path: string | null;
  relativePath: string | null;
  content: string | null;
  session?: {
    startedAt: string;
    durationMinutes: number;
    isActive: boolean;
  };
  error?: string;
}

export interface WorkspacePathResult {
  path: string | null;
  error?: string;
}
