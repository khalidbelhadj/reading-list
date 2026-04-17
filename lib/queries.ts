"use server";

import { withUser } from "@/db";
import { items } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";
import type { Item } from "@/lib/types";

export async function fetchItems(): Promise<Item[]> {
  const userId = await getCurrentUserId();
  const allItems = await withUser(userId, (tx) =>
    tx.query.items.findMany({
      where: eq(items.userId, userId),
      orderBy: [asc(items.position)],
      with: { itemsTags: { with: { tag: true } } },
    }),
  );

  return allItems.map(({ itemsTags, ...item }) => ({
    ...item,
    tags: itemsTags.map((it) => it.tag),
  })) as Item[];
}
