import { db } from "@/db";
import { items } from "@/db/schema";
import { asc } from "drizzle-orm";
import type { Item } from "@/lib/types";

export async function fetchItems(): Promise<Item[]> {
  const allItems = await db.query.items.findMany({
    orderBy: [asc(items.position)],
    with: { itemsTags: { with: { tag: true } } },
  });

  return allItems.map(({ itemsTags, ...item }) => ({
    ...item,
    tags: itemsTags.map((it) => it.tag),
  })) as Item[];
}
