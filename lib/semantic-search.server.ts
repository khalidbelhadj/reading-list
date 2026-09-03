// Semantic search over the index (lib/index/*): nearest chunks by cosine
// distance, folded up to the item or flashcard they belong to. The query
// vector comes from the client worker (the only place the model runs); this
// module only ranks. Used by the Ask / Review agents next to the regex
// search in lib/search.server.ts.
import { sql } from "drizzle-orm";
import { z } from "zod";

import { type Tx } from "@/db";

const toVectorLiteral = (vector: number[]) => `[${vector.join(",")}]`;

const itemHitSchema = z.object({
  item_id: z.string(),
  kind: z.string(),
  heading: z.string().nullable(),
  text: z.string(),
  score: z.number(),
  title: z.string(),
  url: z.string(),
  read: z.boolean(),
  starred: z.boolean(),
  flashcard_count: z.coerce.number(),
});

export type SemanticItemResult = {
  id: string;
  title: string;
  url: string;
  read: boolean;
  starred: boolean;
  flashcardCount: number;
  score: number;
  // Where the best-matching passage came from: the page content, the
  // user's notes, or a flashcard.
  matchedIn: string[];
  snippet: string;
};

const snippetOf = (text: string) =>
  text.replace(/\s+/g, " ").trim().slice(0, 240);

// Nearest chunks of any kind, grouped by item: an item's score is its best
// chunk, and every kind that surfaced is reported.
export const semanticSearchItems = async (
  tx: Tx,
  userId: string,
  query: { model: string; vector: number[] },
  limit: number,
): Promise<SemanticItemResult[]> => {
  const literal = toVectorLiteral(query.vector);
  const rows = await tx.execute(sql`
    SELECT
      c.item_id, c.kind, c.heading, c.text,
      1 - (c.embedding <=> ${literal}::vector) AS score,
      i.title, i.url, i.read, i.starred,
      (SELECT count(*) FROM flashcards f WHERE f.item_id = i.id AND f.user_id = i.user_id) AS flashcard_count
    FROM chunks c
    JOIN items i ON i.id = c.item_id AND i.user_id = c.user_id
    WHERE c.user_id = ${userId}
      AND c.model = ${query.model}
      AND c.embedding IS NOT NULL
      AND c.item_id IS NOT NULL
    ORDER BY c.embedding <=> ${literal}::vector
    LIMIT ${Math.max(20, limit * 4)}
  `);
  const hits = z.array(itemHitSchema).parse(rows);
  const byItem = new Map<string, SemanticItemResult>();
  for (const hit of hits) {
    const existing = byItem.get(hit.item_id);
    if (existing) {
      if (!existing.matchedIn.includes(hit.kind))
        existing.matchedIn.push(hit.kind);
      continue;
    }
    byItem.set(hit.item_id, {
      id: hit.item_id,
      title: hit.title,
      url: hit.url,
      read: hit.read,
      starred: hit.starred,
      flashcardCount: hit.flashcard_count,
      score: Number(hit.score.toFixed(3)),
      matchedIn: [hit.kind],
      snippet: snippetOf(hit.text),
    });
    if (byItem.size >= limit) break;
  }
  return [...byItem.values()];
};

const cardHitSchema = z.object({
  flashcard_id: z.string(),
  score: z.number(),
  front: z.string(),
  back: z.string(),
  item_id: z.string().nullable(),
  item_title: z.string().nullable(),
});

export type SemanticCardResult = {
  id: string;
  itemId: string | null;
  itemTitle: string | null;
  front: string;
  back: string;
  score: number;
};

// Nearest flashcards: each card is one chunk, so this is a plain top-k.
export const semanticSearchCards = async (
  tx: Tx,
  userId: string,
  query: { model: string; vector: number[] },
  limit: number,
): Promise<SemanticCardResult[]> => {
  const literal = toVectorLiteral(query.vector);
  const rows = await tx.execute(sql`
    SELECT
      c.flashcard_id,
      1 - (c.embedding <=> ${literal}::vector) AS score,
      f.front, f.back, f.item_id,
      i.title AS item_title
    FROM chunks c
    JOIN flashcards f ON f.id = c.flashcard_id AND f.user_id = c.user_id
    LEFT JOIN items i ON i.id = f.item_id AND i.user_id = f.user_id
    WHERE c.user_id = ${userId}
      AND c.kind = 'card'
      AND c.model = ${query.model}
      AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> ${literal}::vector
    LIMIT ${limit}
  `);
  return z
    .array(cardHitSchema)
    .parse(rows)
    .map((hit) => ({
      id: hit.flashcard_id,
      itemId: hit.item_id,
      itemTitle: hit.item_title,
      front: hit.front,
      back: hit.back,
      score: Number(hit.score.toFixed(3)),
    }));
};
