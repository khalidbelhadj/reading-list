// Messages between the app (lib/index-client.ts) and the index worker
// (lib/index-worker/worker.ts). Kept in one file so both sides share the
// exact shapes.

export type WorkerPhase =
  "starting" | "loading-model" | "idle" | "working" | "signed-out" | "error";

// The server's counts (app/api/index/server.ts) plus the worker's own state.
export type IndexProgress = {
  phase: WorkerPhase;
  // Model download progress while loading, 0..1.
  modelProgress: number | null;
  message: string | null;
  items: number;
  ok: number;
  pending: number;
  ready: number;
  failed: number;
  unsupported: number;
  chunks: number;
  embedded: number;
  model: string;
};

export type ToWorker =
  | { type: "start" }
  // Something changed (a write, a sync ping): look for work soon.
  | { type: "kick" }
  | { type: "embed-query"; id: number; text: string };

export type FromWorker =
  | { type: "progress"; progress: IndexProgress }
  | { type: "query-result"; id: number; vector?: number[]; error?: string };
