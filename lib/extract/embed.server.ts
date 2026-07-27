// Embedding provider for the semantic index. Three backends behind one
// interface, selected by the app-global config (embedding-config.server.ts,
// picker on /debug/intelligence) and seeded from the env vars this pipeline
// originally shipped with:
//
//   "gemini" (default) — gemini-embedding-001 via the AI SDK
//                        (GOOGLE_GENERATIVE_AI_API_KEY).
//   "openai"           — text-embedding-3-* over the REST API
//                        (OPENAI_API_KEY). Called directly rather than
//                        through the AI SDK: the endpoint is one POST, and
//                        this keeps the `dimensions` request explicit next
//                        to the column width it has to satisfy.
//   "ollama"           — a local model via the Ollama HTTP API. Lower-dim
//                        vectors are zero-padded to 1536, which preserves
//                        cosine similarity exactly.
//
// Vectors are L2-normalized here regardless of backend, and the model id is
// stored on every row. Vectors from different models are never compared:
// searches filter to the active model, and the worker re-embeds rows whose
// stored model no longer matches.
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { embed, embedMany } from "ai";

import {
  EMBEDDING_DIMENSIONS,
  type EmbeddingConfig,
  embeddingModelId,
} from "./embedding-config";
import { getEmbeddingConfig } from "./embedding-config.server";

const google = createGoogleGenerativeAI({});

const normalize = (vector: number[]): number[] => {
  let sumOfSquares = 0;
  for (const value of vector) sumOfSquares += value * value;
  const norm = Math.sqrt(sumOfSquares);
  // A zero vector has no direction, so cosine distance against it is
  // undefined — pgvector would return NaN and the row would rank arbitrarily.
  // Refuse it here instead of storing a poisoned vector.
  if (norm === 0) throw new Error("Embedding backend returned a zero vector");
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
const DEFAULT_OLLAMA_URL = "http://localhost:11434";

// nomic-embed models are trained with task prefixes; other models ignore
// them, so only apply when the model asks for it.
const ollamaText = (
  model: string,
  text: string,
  kind: "document" | "query",
): string => (model.startsWith("nomic") ? `search_${kind}: ${text}` : text);

const ollamaEmbed = async (
  config: EmbeddingConfig,
  texts: string[],
): Promise<number[][]> => {
  const baseUrl = config.ollamaUrl ?? DEFAULT_OLLAMA_URL;
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += OLLAMA_BATCH_SIZE) {
    const batch = texts.slice(i, i + OLLAMA_BATCH_SIZE);
    const res = await fetch(`${baseUrl}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: config.model, input: batch }),
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
// OpenAI backend
// ---------------------------------------------------------------------------

const OPENAI_BATCH_SIZE = 96;

const openaiEmbed = async (
  config: EmbeddingConfig,
  texts: string[],
): Promise<number[][]> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += OPENAI_BATCH_SIZE) {
    const batch = texts.slice(i, i + OPENAI_BATCH_SIZE);
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        input: batch,
        // Ask for the column width directly. text-embedding-3-* are trained
        // with Matryoshka representations, so a truncated vector is still a
        // good vector — unlike naively slicing an arbitrary embedding.
        dimensions: EMBEDDING_DIMENSIONS,
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      throw new Error(`OpenAI embed failed with status ${res.status}`);
    }
    const data = (await res.json()) as {
      data?: { index: number; embedding: number[] }[];
    };
    if (!data.data || data.data.length !== batch.length) {
      throw new Error("OpenAI embed returned a malformed response");
    }
    // The API documents that results may arrive out of order — place each by
    // its index rather than trusting array position.
    const ordered = new Array<number[]>(batch.length);
    for (const entry of data.data) ordered[entry.index] = entry.embedding;
    if (ordered.some((vector) => vector === undefined)) {
      throw new Error("OpenAI embed returned a gap in the result set");
    }
    out.push(...ordered);
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

const geminiEmbedDocuments = async (
  config: EmbeddingConfig,
  texts: string[],
): Promise<number[][]> => {
  const { embeddings } = await embedMany({
    model: google.textEmbedding(config.model),
    values: texts,
    providerOptions: geminiProviderOptions("RETRIEVAL_DOCUMENT"),
  });
  return embeddings;
};

const geminiEmbedQuery = async (
  config: EmbeddingConfig,
  text: string,
): Promise<number[]> => {
  const { embedding } = await embed({
    model: google.textEmbedding(config.model),
    value: text,
    providerOptions: geminiProviderOptions("RETRIEVAL_QUERY"),
  });
  return embedding;
};

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export type EmbedResult = {
  vectors: number[][];
  // The id these vectors must be stored under. Returned rather than read
  // separately by the caller, so a config switch mid-batch can't write
  // vectors from model A tagged as model B.
  modelId: string;
};

export const embedDocuments = async (texts: string[]): Promise<EmbedResult> => {
  const config = await getEmbeddingConfig();
  const modelId = embeddingModelId(config);
  if (texts.length === 0) return { vectors: [], modelId };

  const raw =
    config.provider === "ollama"
      ? await ollamaEmbed(
          config,
          texts.map((text) => ollamaText(config.model, text, "document")),
        )
      : config.provider === "openai"
        ? await openaiEmbed(config, texts)
        : await geminiEmbedDocuments(config, texts);

  // Callers index this result positionally against their input (chunk N gets
  // vector N), so a short response must fail here rather than surface as an
  // undefined vector at the insert.
  if (raw.length !== texts.length) {
    throw new Error(
      `Embedding backend returned ${raw.length} vectors for ${texts.length} inputs`,
    );
  }
  return {
    vectors: raw.map((vector) => normalize(padToDimensions(vector))),
    modelId,
  };
};

export const embedQuery = async (text: string): Promise<EmbedResult> => {
  const config = await getEmbeddingConfig();
  const modelId = embeddingModelId(config);
  const raw =
    config.provider === "ollama"
      ? (
          await ollamaEmbed(config, [ollamaText(config.model, text, "query")])
        )[0]
      : config.provider === "openai"
        ? (await openaiEmbed(config, [text]))[0]
        : await geminiEmbedQuery(config, text);
  if (!raw) throw new Error("Embedding backend returned no vector");
  return { vectors: [normalize(padToDimensions(raw))], modelId };
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
