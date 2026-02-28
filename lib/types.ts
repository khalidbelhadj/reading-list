import type { items, tags } from "@/db/schema";

// DB-level types (source of truth)
export type DbItem = typeof items.$inferSelect;
export type DbTag = typeof tags.$inferSelect;

// App-level types with joined tags
type BaseItem = Omit<DbItem, "type" | "read"> & {
  tags: DbTag[];
};

export type ReadingListItem = BaseItem & {
  type: "reading-list";
  read: boolean;
};

export type BookmarkItem = BaseItem & {
  type: "bookmark";
};

export type Item = ReadingListItem | BookmarkItem;

// Type guard
export function isReadingListItem(item: Item): item is ReadingListItem {
  return item.type === "reading-list";
}
