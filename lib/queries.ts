"use server";

import { withUser } from "@/db";
import { items } from "@/db/schema";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";
import type { Item } from "@/lib/types";
import { perfLog } from "@/lib/perf";

/**
 * Map of itemId → previewImageUrl for the current user, fetched separately
 * from the main items list so the heavy base64 PDF renders don't bloat every
 * load. Only resolved previews are returned (preview_image_url IS NOT NULL):
 *   - present, data URL → render the thumbnail
 *   - present, ""       → checked, not a PDF → skip
 *   - absent (id missing) → never attempted → cozy row probes it on mount
 */
export async function fetchItemPreviews(): Promise<Record<string, string>> {
  const start = performance.now();
  const userId = await getCurrentUserId();
  const rows = await withUser(
    userId,
    (tx) =>
      tx
        .select({ id: items.id, previewImageUrl: items.previewImageUrl })
        .from(items)
        .where(
          and(eq(items.userId, userId), isNotNull(items.previewImageUrl)),
        ),
    "fetchItemPreviews",
  );

  const map: Record<string, string> = {};
  for (const row of rows) map[row.id] = row.previewImageUrl ?? "";

  perfLog("action:fetchItemPreviews", performance.now() - start, {
    previews: rows.length,
  });
  return map;
}

export async function fetchItems(): Promise<Item[]> {
  const start = performance.now();
  const userId = await getCurrentUserId();
  const allItems = await withUser(
    userId,
    (tx) =>
      tx.query.items.findMany({
        // Exclude previewImageUrl: base64 PDF renders are ~94% of this
        // payload and are only needed by the cozy thumbnail. They're loaded
        // separately via fetchItemPreviews. Everything else is selected.
        columns: { previewImageUrl: false },
        with: { itemsTags: { with: { tag: true } } },
        extras: {
          // Flashcard count folded in as a correlated subquery so the list
          // loads in one round-trip instead of a second, serialized query.
          // Raw inner column refs (not the drizzle column object) keep drizzle
          // from rebinding them to the outer alias; ${items.id} correlates to
          // the current row.
          flashcardCount:
            sql<number>`(select count(*)::int from flashcards where flashcards.item_id = ${items.id})`.as(
              "flashcard_count",
            ),
        },
        where: eq(items.userId, userId),
        orderBy: [desc(items.createdAt)],
      }),
    "fetchItems",
  );

  const result = allItems.map(({ itemsTags, ...item }) => ({
    ...item,
    tags: itemsTags.map((it) => it.tag),
  })) as Item[];

  perfLog("action:fetchItems", performance.now() - start, {
    items: result.length,
  });
  return result;
}
