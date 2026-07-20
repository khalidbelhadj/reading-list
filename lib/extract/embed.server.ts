// Embedding provider for the semantic index. Two backends behind one
// interface, selected by EMBEDDING_PROVIDER:
//
//   "gemini" (default) — gemini-embedding-001 via the AI SDK, 1536 dims
//                        (GOOGLE_GENERATIVE_AI_API_KEY).
//   "ollama"           — a local model via the Ollama HTTP API
//                        (OLLAMA_EMBEDDING_MODEL, default nomic-embed-text).
//                        Lower-dim vectors are zero-padded to 1536, which
//                        preserves cosine similarity exactly.
//
// Vectors are L2-normalized here regardless of backend, and the model id is
// stored on every row — vectors from different models are never compared
// (the worker re-embeds when the stored model differs).
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { embed, embedMany } from "ai";

export const EMBEDDING_DIMENSIONS = 1536;

const PROVIDER = process.env.EMBEDDING_PROVIDER ?? "gemini";
const OLLAMA_MODEL = process.env.OLLAMA_EMBEDDING_MODEL ?? "nomic-embed-text";
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const GEMINI_MODEL = "gemini-embedding-001";

export const EMBEDDING_MODEL =
  PROVIDER === "ollama" ? `ollama:${OLLAMA_MODEL}` : GEMINI_MODEL;

const google = createGoogleGenerativeAI({});

const normalize = (vector: number[]): number[] => {
  let sumOfSquares = 0;
  for (const v of vector) sumOfSquares += v * v;
  const norm = Math.sqrt(sumOfSquares);
  if (norm === 0) return vector;
  return vector.map((v) => v / norm);
};

const padToDimensions = (vector: number[]): number[] => {
  if (vector.length === EMBEDDING_DIMENSIONS) return vector;
  if (vector.length > EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding has ${vector.length} dims — exceeds the vector(${EMBEDDING_DIMENSIONS}) column`,
    );
  }
  return [
    ...vector,
    ...new Array<number>(EMBEDDING_DIMENSIONS - vector.length).fill(0),
  ];
};

// ---------------------------------------------------------------------------
// Ollama backend
// ---------------------------------------------------------------------------

const OLLAMA_BATCH_SIZE = 16;

const ollamaEmbed = async (texts: string[]): Promise<number[][]> => {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += OLLAMA_BATCH_SIZE) {
    const batch = texts.slice(i, i + OLLAMA_BATCH_SIZE);
    const res = await fetch(`${OLLAMA_URL}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: OLLAMA_MODEL, input: batch }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      throw new Error(`Ollama embed failed with status ${res.status}`);
    }
    const data = (await res.json()) as { embeddings?: number[][] };
    if (!data.embeddings || data.embeddings.length !== batch.length) {
      throw new Error("Ollama embed returned a malformed response");
    }
    out.push(...data.embeddings);
  }
  return out;
};

// ---------------------------------------------------------------------------
// Gemini backend
// ---------------------------------------------------------------------------

const geminiProviderOptions = (
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
) => ({
  google: {
    outputDimensionality: EMBEDDING_DIMENSIONS,
    taskType,
  },
});

const geminiEmbedDocuments = async (texts: string[]): Promise<number[][]> => {
  const { embeddings } = await embedMany({
    model: google.textEmbedding(GEMINI_MODEL),
    values: texts,
    providerOptions: geminiProviderOptions("RETRIEVAL_DOCUMENT"),
  });
  return embeddings;
};

const geminiEmbedQuery = async (text: string): Promise<number[]> => {
  const { embedding } = await embed({
    model: google.textEmbedding(GEMINI_MODEL),
    value: text,
    providerOptions: geminiProviderOptions("RETRIEVAL_QUERY"),
  });
  return embedding;
};

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

// nomic-embed models are trained with task prefixes; other models ignore
// them, so only apply when the model asks for it.
const needsTaskPrefix = OLLAMA_MODEL.startsWith("nomic");
const documentText = (text: string) =>
  needsTaskPrefix ? `search_document: ${text}` : text;
const queryText = (text: string) =>
  needsTaskPrefix ? `search_query: ${text}` : text;

export const embedDocuments = async (texts: string[]): Promise<number[][]> => {
  if (texts.length === 0) return [];
  const vectors =
    PROVIDER === "ollama"
      ? await ollamaEmbed(texts.map(documentText))
      : await geminiEmbedDocuments(texts);
  return vectors.map((vector) => normalize(padToDimensions(vector)));
};

export const embedQuery = async (text: string): Promise<number[]> => {
  const vector =
    PROVIDER === "ollama"
      ? (await ollamaEmbed([queryText(text)]))[0]
      : await geminiEmbedQuery(text);
  if (!vector) throw new Error("Embedding backend returned no vector");
  return normalize(padToDimensions(vector));
};

// Normalized mean of normalized chunk vectors — the item-level vector used
// for related-items / taste modeling.
export const meanVector = (vectors: number[][]): number[] | null => {
  const first = vectors[0];
  if (!first) return null;
  const sum = new Array<number>(first.length).fill(0);
  for (const vector of vectors) {
    for (let i = 0; i < vector.length; i++)
      sum[i] = (sum[i] ?? 0) + (vector[i] ?? 0);
  }
  return normalize(sum.map((v) => v / vectors.length));
};

// pgvector literal for raw SQL: '[0.1,0.2,...]'::vector
export const toVectorLiteral = (vector: number[]): string =>
  `[${vector.join(",")}]`;
