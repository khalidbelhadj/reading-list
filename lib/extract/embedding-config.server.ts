// Reads and writes the app-global embedding selection.
//
// Stored in app_settings (a single row, id = 'embedding') rather than in
// user_settings, because the selection is global: the worker drains every
// user's rows on the owner connection, and one HNSW index covers the whole
// table. Accessed only through the owner connection — the table carries no
// `authenticated` grant, so there is no RLS surface to get wrong.
//
// Env vars remain the seed: an instance that has never used the picker
// behaves exactly as before.
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { appSettings } from "@/db/schema";

import {
  type EmbeddingConfig,
  embeddingConfigSchema,
  embeddingModelId,
  findModel,
  isModelSupported,
} from "./embedding-config";

const EMBEDDING_SETTINGS_ID = "embedding";

// Seeded from EMBEDDING_PROVIDER. The fallback is local Ollama: the hosted
// providers are rate-limited per minute and per day, and a free-tier quota
// stall is silent — extraction succeeds, the vector is never written, and the
// item drops out of search with nothing to see. A local model has no quota,
// so the queue can actually drain. Deployments that can't reach an Ollama
// host must set EMBEDDING_PROVIDER (or pick a model in the picker, which is
// stored in app_settings and wins over this).
const envDefault = (): EmbeddingConfig => {
  const provider = process.env.EMBEDDING_PROVIDER;
  if (provider === "gemini") {
    return { provider: "gemini", model: "gemini-embedding-001" };
  }
  if (provider === "openai") {
    return { provider: "openai", model: "text-embedding-3-small" };
  }
  return {
    provider: "ollama",
    model: process.env.OLLAMA_EMBEDDING_MODEL ?? "nomic-embed-text",
    ollamaUrl: process.env.OLLAMA_URL ?? "http://localhost:11434",
  };
};

// Short TTL rather than a permanent memo: embedding runs in long-lived server
// processes, and a selection made in one process has to reach the others
// without a restart. 30s bounds how long a just-switched model keeps writing
// under the old id.
const CACHE_TTL_MS = 30_000;
let cached: { config: EmbeddingConfig; at: number } | null = null;

export const getEmbeddingConfig = async (): Promise<EmbeddingConfig> => {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.config;
  let config = envDefault();
  try {
    const [row] = await db
      .select({ data: appSettings.data })
      .from(appSettings)
      .where(eq(appSettings.id, EMBEDDING_SETTINGS_ID))
      .limit(1);
    if (row?.data) {
      const parsed = embeddingConfigSchema.safeParse(row.data);
      if (parsed.success) config = parsed.data;
    }
  } catch (error) {
    // A missing table (schema not applied yet) must not take embedding down —
    // fall back to the env default, which is what this instance used before.
    console.warn("[extract] could not read embedding config", error);
  }
  cached = { config, at: Date.now() };
  return config;
};

export const setEmbeddingConfig = async (
  next: EmbeddingConfig,
): Promise<EmbeddingConfig> => {
  const parsed = embeddingConfigSchema.parse(next);
  const model = findModel(parsed.provider, parsed.model);
  if (!model) {
    throw new Error(`Unknown model ${parsed.provider}:${parsed.model}`);
  }
  if (!isModelSupported(model)) {
    throw new Error(
      `${model.label} produces ${model.nativeDimensions}-dim vectors and cannot be narrowed to fit the column`,
    );
  }
  const now = new Date().toISOString();
  await db
    .insert(appSettings)
    .values({ id: EMBEDDING_SETTINGS_ID, data: parsed, updatedAt: now })
    .onConflictDoUpdate({
      target: appSettings.id,
      set: { data: parsed, updatedAt: now },
    });
  cached = { config: parsed, at: Date.now() };
  return parsed;
};

// The identifier written to item_content.embedding_model / item_chunks.model,
// and the one searches filter on.
export const getActiveModelId = async (): Promise<string> =>
  embeddingModelId(await getEmbeddingConfig());
