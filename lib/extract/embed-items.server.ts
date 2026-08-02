// Chunk → embed → store, for one item or for many items in a single provider
// call.
//
// Batching across items is the point of this module. One call per item is what
// the pipeline used to do, and it is the wrong unit: a typical item is 2–5
// chunks, so a 10-item pass made 10 round trips carrying 30 texts between
// them. Providers price and rate-limit per request as much as per token, and
// a local Ollama pays its model-load cost per request too — so the same work
// batched is several times faster and counts as one unit against any quota.
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { itemChunks, itemContent } from "@/db/schema";

import { chunkMarkdown } from "./chunk";
import { embedDocuments, meanVector } from "./embed.server";
import { IndexFailure, toIndexFailure } from "./failure";

// How many items' chunks go out in one provider call. Bounded because a
// failure fails the whole batch: small enough that one bad pass is cheap to
// redo, large enough that the per-request overhead stops dominating.
export const EMBED_BATCH_ITEMS = 8;

export type EmbedSource = {
  itemId: string;
  userId: string;
  title: string | null;
  markdown: string;
};

export type EmbedOutcome =
  // Vectors written.
  | { itemId: string; result: "embedded" }
  // Carries the reason so the caller records it without re-deriving it from a
  // message. "No chunks" is a failure like any other — it has a reason
  // (`no_content`) and that reason says retrying will not help.
  | { itemId: string; result: "failed"; failure: IndexFailure };

const nowIso = () => new Date().toISOString();

// The title rides on every chunk at embed time (not in the stored text) so
// each vector carries the document's identity.
const withTitle = (title: string | null, chunk: string): string =>
  title ? `${title}\n\n${chunk}` : chunk;

const writeVectors = async (
  source: EmbedSource,
  chunks: string[],
  vectors: number[][],
  modelId: string,
): Promise<void> => {
  const now = nowIso();
  await db.transaction(async (tx) => {
    await tx.delete(itemChunks).where(eq(itemChunks.itemId, source.itemId));
    await tx.insert(itemChunks).values(
      chunks.map((chunk, index) => ({
        id: `${source.itemId}#${index}`,
        userId: source.userId,
        itemId: source.itemId,
        chunkIndex: index,
        text: chunk,
        embedding: vectors[index]!,
        model: modelId,
        createdAt: now,
      })),
    );
    await tx
      .update(itemContent)
      .set({
        embedding: meanVector(vectors),
        embeddingModel: modelId,
        updatedAt: now,
      })
      .where(eq(itemContent.itemId, source.itemId));
  });
};

/**
 * Embeds every source in as few provider calls as the batch size allows, and
 * reports one typed outcome per input. Never throws: a provider failure
 * becomes a `failed` outcome for each item in that batch, because the caller's
 * job is to record why a row didn't embed, not to abandon the pass.
 */
export const embedItems = async (
  sources: EmbedSource[],
): Promise<EmbedOutcome[]> => {
  const outcomes: EmbedOutcome[] = [];
  const chunked: { source: EmbedSource; chunks: string[] }[] = [];

  for (const source of sources) {
    const chunks = chunkMarkdown(source.markdown);
    if (chunks.length === 0) {
      outcomes.push({
        itemId: source.itemId,
        result: "failed",
        failure: new IndexFailure(
          "no_content",
          "Extracted text produced no chunks",
        ),
      });
      continue;
    }
    chunked.push({ source, chunks });
  }

  for (let i = 0; i < chunked.length; i += EMBED_BATCH_ITEMS) {
    const batch = chunked.slice(i, i + EMBED_BATCH_ITEMS);
    const texts = batch.flatMap(({ source, chunks }) =>
      chunks.map((chunk) => withTitle(source.title, chunk)),
    );
    try {
      // modelId comes back from the same call that produced the vectors —
      // read separately, a config switch between the embed and the write
      // would tag model A's vectors as model B's, which is exactly the
      // mislabelling that makes a mixed corpus impossible to clean up.
      const { vectors, modelId } = await embedDocuments(texts);
      let offset = 0;
      for (const { source, chunks } of batch) {
        const slice = vectors.slice(offset, offset + chunks.length);
        offset += chunks.length;
        try {
          await writeVectors(source, chunks, slice, modelId);
          outcomes.push({ itemId: source.itemId, result: "embedded" });
        } catch (error) {
          outcomes.push({
            itemId: source.itemId,
            result: "failed",
            failure: toIndexFailure(error),
          });
        }
      }
    } catch (error) {
      // The provider call failed, so nothing in this batch has vectors. Every
      // item in it gets the same reason, because it is the same failure.
      const failure = toIndexFailure(error);
      for (const { source } of batch) {
        outcomes.push({ itemId: source.itemId, result: "failed", failure });
      }
    }
  }

  return outcomes;
};
