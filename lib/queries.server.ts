// Server-only implementations — see ./queries.ts for the RPC layer.
import { withUser } from "@/db";
import { flashcards, items } from "@/db/schema";
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
        .where(and(eq(items.userId, userId), isNotNull(items.previewImageUrl))),
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
  const [allItems, counts] = await withUser(
    userId,
    (tx) =>
      Promise.all([
        tx.query.items.findMany({
          // Exclude previewImageUrl: base64 PDF renders are ~94% of this
          // payload and are only needed by the cozy thumbnail. They're loaded
          // separately via fetchItemPreviews. Everything else is selected.
          columns: { previewImageUrl: false },
          where: eq(items.userId, userId),
          orderBy: [desc(items.createdAt)],
          with: { itemsTags: { with: { tag: true } } },
        }),
        tx
          .select({
            itemId: flashcards.itemId,
            count: sql<number>`count(*)::int`,
          })
          .from(flashcards)
          .where(eq(flashcards.userId, userId))
          .groupBy(flashcards.itemId),
      ]),
    "fetchItems",
  );

  const countById = new Map(
    counts.filter((r) => r.itemId !== null).map((r) => [r.itemId!, r.count]),
  );

  const result = allItems.map(({ itemsTags, ...item }) => ({
    ...item,
    tags: itemsTags.map((it) => it.tag),
    flashcardCount: countById.get(item.id) ?? 0,
  })) as Item[];

  perfLog("action:fetchItems", performance.now() - start, {
    items: result.length,
  });
  return result;
}
