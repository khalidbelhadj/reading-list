"use server";

import { withUser } from "@/db";
import { flashcards, items } from "@/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";
import type { Item } from "@/lib/types";
import { perfLog } from "@/lib/perf";

export async function fetchItems(): Promise<Item[]> {
  const start = performance.now();
  const userId = await getCurrentUserId();
  const [allItems, counts] = await withUser(
    userId,
    (tx) =>
      Promise.all([
        tx.query.items.findMany({
          where: eq(items.userId, userId),
          orderBy: [asc(items.position)],
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
