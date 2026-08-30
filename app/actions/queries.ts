// Server-only implementations — see ./index.ts for the RPC layer.
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";

import { flashcards, items } from "@/db/schema";
import { withCurrentUser } from "@/lib/db-helpers.server";
import { time } from "@/lib/perf";
import { safeAction } from "@/lib/safe-action";
import type { Item } from "@/lib/types";

/**
 * Map of itemId → previewImageUrl for the current user, fetched separately
 * from the main items list so the heavy base64 PDF renders don't bloat every
 * load. Only resolved previews are returned (preview_image_url IS NOT NULL):
 *   - present, data URL → render the thumbnail
 *   - present, ""       → checked, not a PDF → skip
 *   - absent (id missing) → never attempted → preview row probes it on mount
 */
export const fetchItemPreviews = safeAction(
  async function fetchItemPreviews(): Promise<Record<string, string>> {
    return time("action:fetchItemPreviews", async () => {
      const rows = await withCurrentUser(
        (tx, userId) =>
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
      return map;
    });
  },
  "Could not load previews. Please try again.",
);

export const fetchItems = safeAction(async function fetchItems(): Promise<
  Item[]
> {
  return time("action:fetchItems", async () => {
    const [allItems, counts] = await withCurrentUser((tx, userId) => {
      return Promise.all([
        tx.query.items.findMany({
          // Exclude previewImageUrl: base64 PDF renders are ~94% of this
          // payload and are only needed by the preview thumbnail. They're
          // loaded separately via fetchItemPreviews.
          columns: { previewImageUrl: false },
          where: eq(items.userId, userId),
          orderBy: [desc(items.createdAt)],
        }),
        tx
          .select({
            itemId: flashcards.itemId,
            count: sql<number>`count(*)::int`,
          })
          .from(flashcards)
          .where(eq(flashcards.userId, userId))
          .groupBy(flashcards.itemId),
      ]);
    }, "fetchItems");

    const countById = new Map(
      counts.filter((r) => r.itemId !== null).map((r) => [r.itemId!, r.count]),
    );

    return allItems.map((item) => ({
      ...item,
      flashcardCount: countById.get(item.id) ?? 0,
    })) as Item[];
  });
}, "Could not load items. Please try again.");
