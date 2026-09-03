// Read side of the index: the status counts the worker reports, and the
// "read this item" view the agents use to check a candidate before including
// it.
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { type Tx } from "@/db";
import { flashcards, itemContent, items } from "@/db/schema";

export type IndexStatus = {
  // Linked items, and how many of them are in each extraction state.
  items: number;
  ok: number;
  pending: number;
  // Pending jobs that can be claimed right now (backoff elapsed, no lease).
  ready: number;
  failed: number;
  unsupported: number;
  // Chunks (content, notes, cards) and how many carry a current embedding.
  chunks: number;
  embedded: number;
  model: string;
};

const countsSchema = z.object({
  items: z.coerce.number(),
  ok: z.coerce.number(),
  pending: z.coerce.number(),
  ready: z.coerce.number(),
  failed: z.coerce.number(),
  unsupported: z.coerce.number(),
});
const chunkCountsSchema = z.object({
  chunks: z.coerce.number(),
  embedded: z.coerce.number(),
});

// `model` is the embedding model the caller (the client worker) uses; only
// chunks embedded by it count as embedded.
export const indexStatus = async (
  tx: Tx,
  userId: string,
  model: string,
): Promise<IndexStatus> => {
  const [content] = z.array(countsSchema).parse(
    await tx.execute(sql`
      SELECT
        count(*) AS items,
        count(*) FILTER (WHERE status = 'ok') AS ok,
        count(*) FILTER (WHERE status = 'pending') AS pending,
        count(*) FILTER (
          WHERE status = 'pending'
            AND (next_retry_at IS NULL OR next_retry_at < now())
            AND (claimed_until IS NULL OR claimed_until < now())
        ) AS ready,
        count(*) FILTER (WHERE status = 'failed') AS failed,
        count(*) FILTER (WHERE status = 'unsupported') AS unsupported
      FROM item_content WHERE user_id = ${userId}
    `),
  );
  const [chunkCounts] = z.array(chunkCountsSchema).parse(
    await tx.execute(sql`
      SELECT
        count(*) AS chunks,
        count(*) FILTER (WHERE embedding IS NOT NULL AND model = ${model}) AS embedded
      FROM chunks WHERE user_id = ${userId}
    `),
  );
  return {
    items: content?.items ?? 0,
    ok: content?.ok ?? 0,
    pending: content?.pending ?? 0,
    ready: content?.ready ?? 0,
    failed: content?.failed ?? 0,
    unsupported: content?.unsupported ?? 0,
    chunks: chunkCounts?.chunks ?? 0,
    embedded: chunkCounts?.embedded ?? 0,
    model,
  };
};

export type ItemContext = {
  id: string;
  title: string;
  url: string;
  notes: string | null;
  contentStatus: string | null;
  // Extracted content, truncated: enough to judge what the item is about.
  content: string | null;
  cards: { id: string; front: string; back: string }[];
};

const MAX_CONTEXT_CHARS = 6_000;

export const itemContext = async (
  tx: Tx,
  userId: string,
  itemId: string,
): Promise<ItemContext | null> => {
  const [item] = await tx
    .select({
      id: items.id,
      title: items.title,
      url: items.url,
      notes: items.notes,
      contentStatus: itemContent.status,
      markdown: itemContent.markdown,
    })
    .from(items)
    .leftJoin(itemContent, eq(itemContent.itemId, items.id))
    .where(and(eq(items.id, itemId), eq(items.userId, userId)));
  if (!item) return null;
  const cards = await tx
    .select({
      id: flashcards.id,
      front: flashcards.front,
      back: flashcards.back,
    })
    .from(flashcards)
    .where(and(eq(flashcards.itemId, itemId), eq(flashcards.userId, userId)));
  const markdown = item.markdown ?? null;
  return {
    id: item.id,
    title: item.title,
    url: item.url,
    notes: item.notes,
    contentStatus: item.contentStatus ?? null,
    content:
      markdown && markdown.length > MAX_CONTEXT_CHARS
        ? `${markdown.slice(0, MAX_CONTEXT_CHARS)}\n\n[truncated]`
        : markdown,
    cards,
  };
};
