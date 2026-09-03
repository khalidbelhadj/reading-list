// The index worker: a Web Worker that keeps the search index built, off the
// main thread and outside React. It owns the loop, the extractor ladder, and
// the embedding model; the server is only storage (app/api/index/server.ts).
//
// Life cycle: `start` runs a tick, and a tick schedules the next — soon while
// there is work, once a minute when there isn't. A `kick` (any write, a sync
// ping from another device) pulls the next tick forward. A tick asks the
// server for work, embeds pending chunks, then extracts a few urls. Signed
// out, it waits and retries; a failing tick backs off.
import {
  type ContentJob,
  fetchJobs,
  type PendingChunk,
  type ServerStatus,
  SignedOutError,
  submitContent,
  submitEmbeddings,
  submitFailure,
} from "./api";
import { embedTexts, loadEmbedder, MODEL_ID } from "./embed";
import { extractContent, UnsupportedContentError } from "./extract";
import {
  type FromWorker,
  type IndexProgress,
  type ToWorker,
  type WorkerPhase,
} from "./protocol";

const EMBED_BATCH = 16;
const JOBS_PER_TICK = 2;
const BUSY_DELAY_MS = 500;
const IDLE_DELAY_MS = 60_000;
const KICK_DELAY_MS = 1_500;
const SIGNED_OUT_DELAY_MS = 5 * 60_000;
const ERROR_DELAY_MS = 30_000;

const post = (message: FromWorker) => postMessage(message);

const emptyStatus: ServerStatus = {
  items: 0,
  ok: 0,
  pending: 0,
  ready: 0,
  failed: 0,
  unsupported: 0,
  chunks: 0,
  embedded: 0,
  model: MODEL_ID,
};

let serverStatus: ServerStatus = emptyStatus;
let phase: WorkerPhase = "starting";
let modelProgress: number | null = null;
let message: string | null = null;

const report = () => {
  const progress: IndexProgress = {
    ...serverStatus,
    phase,
    modelProgress,
    message,
  };
  post({ type: "progress", progress });
};

const setPhase = (next: WorkerPhase, note: string | null = null) => {
  phase = next;
  message = note;
  report();
};

const chunkText = (chunk: PendingChunk) =>
  chunk.heading ? `${chunk.heading}\n\n${chunk.text}` : chunk.text;

const embedPending = async (chunks: PendingChunk[]) => {
  for (let start = 0; start < chunks.length; start += EMBED_BATCH) {
    const batch = chunks.slice(start, start + EMBED_BATCH);
    const vectors = await embedTexts(batch.map(chunkText), "document");
    const { status } = await submitEmbeddings(
      MODEL_ID,
      batch.map((chunk, index) => ({
        id: chunk.id,
        embedding: vectors[index] ?? [],
      })),
    );
    serverStatus = status;
    report();
  }
};

const runJob = async (job: ContentJob) => {
  try {
    const extracted = await extractContent(job.url);
    const { status } = await submitContent(MODEL_ID, {
      itemId: job.itemId,
      ...extracted,
    });
    serverStatus = status;
  } catch (error) {
    if (error instanceof SignedOutError) throw error;
    const note = error instanceof Error ? error.message : String(error);
    const permanent = error instanceof UnsupportedContentError;
    console.warn(
      `[index] ${permanent ? "unsupported" : "failed"}: ${job.url}: ${note}`,
    );
    await submitFailure(job.itemId, note, permanent);
  }
  report();
};

// One pass: fetch work, embed, extract. Returns whether more is waiting.
const tick = async (): Promise<boolean> => {
  const { chunks, jobs, status } = await fetchJobs(
    MODEL_ID,
    JOBS_PER_TICK,
    EMBED_BATCH * 2,
  );
  serverStatus = status;
  if (chunks.length === 0 && jobs.length === 0) {
    setPhase("idle");
    return false;
  }
  if (chunks.length > 0) {
    // First use downloads the model; show that instead of a silent stall.
    setPhase("loading-model");
    await loadEmbedder((fraction) => {
      modelProgress = fraction;
      report();
    });
    modelProgress = null;
    setPhase("working");
    await embedPending(chunks);
  }
  setPhase("working");
  for (const job of jobs) await runJob(job);
  // Content just extracted has chunks waiting to be embedded.
  return true;
};

let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;

const schedule = (delay: number) => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void run();
  }, delay);
};

const run = async () => {
  if (running) return;
  running = true;
  let delay = IDLE_DELAY_MS;
  try {
    delay = (await tick()) ? BUSY_DELAY_MS : IDLE_DELAY_MS;
  } catch (error) {
    if (error instanceof SignedOutError) {
      setPhase("signed-out", "Sign in to keep the index up to date");
      delay = SIGNED_OUT_DELAY_MS;
    } else {
      const note = error instanceof Error ? error.message : String(error);
      console.warn("[index] tick failed:", error);
      setPhase("error", note);
      delay = ERROR_DELAY_MS;
    }
  } finally {
    running = false;
  }
  schedule(delay);
};

const embedQuery = async (id: number, text: string) => {
  try {
    const [vector] = await embedTexts([text], "query");
    post({ type: "query-result", id, vector });
  } catch (error) {
    post({
      type: "query-result",
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

onmessage = (event: MessageEvent<ToWorker>) => {
  const data = event.data;
  if (data.type === "start") {
    report();
    schedule(0);
  } else if (data.type === "kick") {
    // A running tick will see the new work on its next pass anyway.
    if (!running) schedule(KICK_DELAY_MS);
  } else if (data.type === "embed-query") {
    void embedQuery(data.id, data.text);
  }
};
