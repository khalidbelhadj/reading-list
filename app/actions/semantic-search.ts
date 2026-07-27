// Vector search over the intelligence layer's embeddings: query-to-chunk
// (semanticSearch) and item-to-item (getRelatedItems).
//
// Both are constrained to a single model's corpus. Distances between vectors
// from different models are noise rather than weak matches — they land at
// plausible-looking scores with no threshold that separates them from real
// hits — so a mixed corpus has to be partitioned, not ranked across. Rows on
// an older model rejoin results as the drain paths re-embed them
// (reembedMissing in lib/extract/worker.server.ts).
//
// Split from ./intelligence.ts, which owns the pipeline's job state.
import { sql } from "drizzle-orm";
import { z } from "zod";

import { requireAuth, withCurrentUser } from "@/lib/db-helpers.server";
import { embedQuery, toVectorLiteral } from "@/lib/extract/embed.server";
import { tuneAnnScan } from "@/lib/extract/vector-search.server";
import { safeAction } from "@/lib/safe-action";
import {
  parseInput,
  relatedItemsSchema,
  semanticSearchSchema,
} from "@/lib/schemas";

const semanticHitSchema = z.object({
  item_id: z.string(),
  item_title: z.string(),
  url: z.string(),
  read: z.boolean(),
  chunk_index: z.number(),
  snippet: z.string(),
  similarity: z.number(),
});

export type SemanticHit = {
  itemId: string;
  itemTitle: string;
  url: string;
  read: boolean;
  chunkIndex: number;
  snippet: string;
  similarity: number;
};

export const semanticSearch = safeAction(async function semanticSearch(
  query: string,
  limit?: number,
): Promise<SemanticHit[]> {
  const parsed = parseInput(semanticSearchSchema, { query, limit });
  // Authenticate before embedding — the provider call costs quota and must
  // not be reachable unauthenticated.
  await requireAuth();
  // The query vector and the model it was produced with come from the same
  // call, so the filter below can't drift from what was actually embedded.
  const { vectors, modelId } = await embedQuery(parsed.query);
  const vector = toVectorLiteral(vectors[0]!);
  return withCurrentUser(async (tx, userId) => {
    // The user_id and model filters are post-filters over the HNSW candidate
    // set, so without this the query can silently return fewer hits than
    // LIMIT once the table holds other users' or other models' chunks.
    await tuneAnnScan(tx);
    const raw = await tx.execute(sql`
      SELECT c.item_id, i.title AS item_title, i.url, i.read,
        c.chunk_index, left(c.text, 400) AS snippet,
        (1 - (c.embedding <=> ${vector}::vector))::float8 AS similarity
      FROM item_chunks c
      JOIN items i ON i.id = c.item_id
      WHERE c.user_id = ${userId}
        -- Distances between vectors from different models are noise, not
        -- weak matches: they would interleave with real hits at plausible-
        -- looking scores and there is no threshold that separates them.
        -- Restrict to the active model; stale rows rejoin as they re-embed.
        AND c.model = ${modelId}
      ORDER BY c.embedding <=> ${vector}::vector
      LIMIT ${parsed.limit ?? 10}
    `);
    return z
      .array(semanticHitSchema)
      .parse(Array.from(raw))
      .map((row) => ({
        itemId: row.item_id,
        itemTitle: row.item_title,
        url: row.url,
        read: row.read,
        chunkIndex: row.chunk_index,
        snippet: row.snippet,
        similarity: row.similarity,
      }));
  });
}, "Could not run semantic search.");

const relatedItemSchema = z.object({
  item_id: z.string(),
  item_title: z.string(),
  url: z.string(),
  read: z.boolean(),
  similarity: z.number(),
});

export type RelatedItem = {
  itemId: string;
  itemTitle: string;
  url: string;
  read: boolean;
  similarity: number;
};

// Item-to-item nearest neighbors over the item-level vectors — the "read
// next" primitive.
export const getRelatedItems = safeAction(async function getRelatedItems(
  itemId: string,
  limit?: number,
): Promise<RelatedItem[]> {
  const parsed = parseInput(relatedItemsSchema, { itemId, limit });
  return withCurrentUser(async (tx, userId) => {
    const raw = await tx.execute(sql`
      SELECT other.item_id, i.title AS item_title, i.url, i.read,
        (1 - (other.embedding <=> me.embedding))::float8 AS similarity
      FROM item_content me
      JOIN item_content other
        ON other.user_id = me.user_id
        AND other.item_id <> me.item_id
        AND other.embedding IS NOT NULL
        -- Compare only within one model's corpus. Anchored to *this item's*
        -- model rather than the active one, so an item that hasn't re-embedded
        -- yet still gets meaningful neighbours from its own generation
        -- instead of an empty list.
        AND other.embedding_model = me.embedding_model
      JOIN items i ON i.id = other.item_id
      WHERE me.item_id = ${parsed.itemId}
        AND me.user_id = ${userId}
        AND me.embedding IS NOT NULL
      ORDER BY other.embedding <=> me.embedding
      LIMIT ${parsed.limit ?? 6}
    `);
    return z
      .array(relatedItemSchema)
      .parse(Array.from(raw))
      .map((row) => ({
        itemId: row.item_id,
        itemTitle: row.item_title,
        url: row.url,
        read: row.read,
        similarity: row.similarity,
      }));
  });
}, "Could not load related items.");
