// The embedding model catalog and the shape of the app's active selection.
// Client-safe: the debug page's picker imports this, so keep it free of
// server-only imports.
//
// Selection is app-global, not per-user. The worker drains the queue across
// all users on the owner connection, and one HNSW index covers every row —
// vectors from different models are meaningless to compare, so a single
// active model is what keeps that index coherent.
import { z } from "zod";

// Both vector columns are vector(1536) and the HNSW index is built on them,
// so this is a hard ceiling, not a preference. Models with a larger native
// width must be asked for a reduced output (see `reducible` below); models
// narrower than this are zero-padded, which preserves cosine similarity
// exactly.
export const EMBEDDING_DIMENSIONS = 1536;

const EMBEDDING_PROVIDERS = ["gemini", "openai", "ollama"] as const;
export type EmbeddingProvider = (typeof EMBEDDING_PROVIDERS)[number];

export const PROVIDER_LABELS: Record<EmbeddingProvider, string> = {
  gemini: "Gemini",
  openai: "OpenAI",
  ollama: "Ollama (local)",
};

// The env var holding each provider's credential. Ollama has none — it's a
// local HTTP server — which is also why it's the only provider that can be
// "configured" without a key.
export const PROVIDER_KEY_ENV: Record<EmbeddingProvider, string | null> = {
  gemini: "GOOGLE_GENERATIVE_AI_API_KEY",
  openai: "OPENAI_API_KEY",
  ollama: null,
};

export type EmbeddingModelInfo = {
  provider: EmbeddingProvider;
  // Provider-side model id, sent on the wire.
  id: string;
  label: string;
  // Native output width.
  nativeDimensions: number;
  // Whether the provider accepts a requested output width. When true and
  // nativeDimensions exceeds the column, we ask for EMBEDDING_DIMENSIONS.
  // When false, a model wider than the column simply can't be offered.
  reducible: boolean;
  note?: string;
};

export const EMBEDDING_MODELS: EmbeddingModelInfo[] = [
  {
    provider: "gemini",
    id: "gemini-embedding-001",
    label: "gemini-embedding-001",
    nativeDimensions: 3072,
    reducible: true,
    note: "Requested at 1536 via outputDimensionality.",
  },
  {
    provider: "openai",
    id: "text-embedding-3-small",
    label: "text-embedding-3-small",
    nativeDimensions: 1536,
    reducible: true,
    note: "Fits the column natively.",
  },
  {
    provider: "openai",
    id: "text-embedding-3-large",
    label: "text-embedding-3-large",
    nativeDimensions: 3072,
    reducible: true,
    note: "Requested at 1536 via the dimensions parameter.",
  },
  {
    provider: "ollama",
    id: "nomic-embed-text",
    label: "nomic-embed-text",
    nativeDimensions: 768,
    reducible: false,
    note: "Zero-padded to 1536. Needs the model pulled locally.",
  },
  {
    provider: "ollama",
    id: "mxbai-embed-large",
    label: "mxbai-embed-large",
    nativeDimensions: 1024,
    reducible: false,
    note: "Zero-padded to 1536. Needs the model pulled locally.",
  },
];

// A model is usable only if its vectors can land in the column: either it
// already fits, or the provider lets us ask for a narrower output.
export const isModelSupported = (model: EmbeddingModelInfo): boolean =>
  model.nativeDimensions <= EMBEDDING_DIMENSIONS || model.reducible;

export const findModel = (
  provider: EmbeddingProvider,
  id: string,
): EmbeddingModelInfo | undefined =>
  EMBEDDING_MODELS.find(
    (model) => model.provider === provider && model.id === id,
  );

export const embeddingConfigSchema = z.object({
  provider: z.enum(EMBEDDING_PROVIDERS),
  model: z.string().min(1),
  // Ollama's endpoint. Ignored by the hosted providers; stored so switching
  // to a non-default local server doesn't need a redeploy.
  ollamaUrl: z.string().url().optional(),
});

export type EmbeddingConfig = z.infer<typeof embeddingConfigSchema>;

// The stored model *identifier* — what lands in item_content.embedding_model
// and item_chunks.model, and what the staleness check compares against.
// Namespaced by provider so "same model id, different provider" can't
// silently compare across corpora.
export const embeddingModelId = (config: EmbeddingConfig): string =>
  `${config.provider}:${config.model}`;
