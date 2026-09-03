// The worker's client for the storage API (app/api/index/server.ts) and the
// fetch proxy (app/api/fetch/server.ts). Same-origin fetch carries the
// session cookie; a 401 means the app is signed out.

import { type IndexProgress } from "./protocol";

export class SignedOutError extends Error {
  constructor() {
    super("Signed out");
    this.name = "SignedOutError";
  }
}

export type ServerStatus = Omit<
  IndexProgress,
  "phase" | "modelProgress" | "message"
>;

export type PendingChunk = { id: string; heading: string | null; text: string };
export type ContentJob = { itemId: string; url: string; attempts: number };

const post = async <T>(action: string, body: unknown): Promise<T> => {
  const res = await fetch(`/api/index/${action}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new SignedOutError();
  if (!res.ok) throw new Error(`index/${action}: HTTP ${res.status}`);
  return (await res.json()) as T;
};

export const fetchJobs = (
  model: string,
  jobLimit: number,
  chunkLimit: number,
) =>
  post<{ chunks: PendingChunk[]; jobs: ContentJob[]; status: ServerStatus }>(
    "jobs",
    { model, jobLimit, chunkLimit },
  );

export const submitContent = (
  model: string,
  content: {
    itemId: string;
    extractor: string;
    title: string | null;
    markdown: string;
  },
) => post<{ status: ServerStatus }>("content", { ...content, model });

export const submitFailure = (
  itemId: string,
  message: string,
  permanent: boolean,
) => post<{ ok: true }>("failure", { itemId, message, permanent });

export const submitEmbeddings = (
  model: string,
  vectors: { id: string; embedding: number[] }[],
) => post<{ status: ServerStatus }>("embeddings", { model, vectors });

// A page's bytes through the proxy. 422 is the server saying the link can
// never be fetched (private address, blocked host); a 4xx from upstream is
// the page's own answer; everything else is worth a retry later.
export class FetchError extends Error {
  constructor(
    message: string,
    public readonly permanent: boolean,
  ) {
    super(message);
    this.name = "FetchError";
  }
}

export const fetchUrl = async (
  url: string,
): Promise<{ bytes: Uint8Array; contentType: string; finalUrl: string }> => {
  const res = await fetch(`/api/fetch?url=${encodeURIComponent(url)}`, {
    credentials: "same-origin",
  });
  if (res.status === 401) throw new SignedOutError();
  if (!res.ok) {
    const permanent =
      res.status === 422 ||
      res.status === 413 ||
      (res.status >= 400 && res.status < 500 && res.status !== 429);
    throw new FetchError(`HTTP ${res.status}`, permanent);
  }
  return {
    bytes: new Uint8Array(await res.arrayBuffer()),
    contentType: res.headers.get("content-type") ?? "",
    finalUrl: res.headers.get("x-final-url") ?? url,
  };
};
