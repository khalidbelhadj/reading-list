// The app's handle on the index worker (lib/index-worker/worker.ts): start
// it once, kick it after writes, ask it for query embeddings, and read its
// progress. A module singleton with a subscribe/snapshot pair; React reads
// it through useIndexProgress and nothing else in the app touches it.
import { useSyncExternalStore } from "react";

import {
  type FromWorker,
  type IndexProgress,
  type ToWorker,
} from "./index-worker/protocol";

// Must match MODEL_ID in lib/index-worker/embed.ts (the worker module is not
// imported here so the model code never lands in the main bundle).
export const INDEX_MODEL_ID = "browser:nomic-embed-text-v1.5";

let worker: Worker | null = null;
let progress: IndexProgress | null = null;
const listeners = new Set<() => void>();
const pendingQueries = new Map<
  number,
  { resolve: (vector: number[]) => void; reject: (error: Error) => void }
>();
let nextQueryId = 1;

const send = (message: ToWorker) => worker?.postMessage(message);

const handleMessage = (event: MessageEvent<FromWorker>) => {
  const data = event.data;
  if (data.type === "progress") {
    progress = data.progress;
    for (const listener of listeners) listener();
  } else if (data.type === "query-result") {
    const pending = pendingQueries.get(data.id);
    if (!pending) return;
    pendingQueries.delete(data.id);
    if (data.vector) pending.resolve(data.vector);
    else pending.reject(new Error(data.error ?? "Embedding failed"));
  }
};

// Start the worker (idempotent). Called by the shell once the app is up;
// the worker itself backs off if it finds the session is gone.
export const startIndexer = () => {
  if (worker || typeof Worker === "undefined") return;
  worker = new Worker(new URL("./index-worker/worker.ts", import.meta.url), {
    type: "module",
    name: "index",
  });
  worker.onmessage = handleMessage;
  worker.onerror = (event) => {
    console.warn("[index] worker error:", event.message);
  };
  send({ type: "start" });
};

// Something changed; look for work soon.
export const kickIndexer = () => send({ type: "kick" });

// A query vector from the worker's model — the same model that embedded the
// chunks, which is what makes the search meaningful.
export const embedQuery = (text: string): Promise<number[]> => {
  if (!worker) return Promise.reject(new Error("Index worker not running"));
  const id = nextQueryId++;
  return new Promise((resolve, reject) => {
    pendingQueries.set(id, { resolve, reject });
    send({ type: "embed-query", id, text });
  });
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getSnapshot = () => progress;
const getServerSnapshot = () => null;

export const useIndexProgress = (): IndexProgress | null =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
