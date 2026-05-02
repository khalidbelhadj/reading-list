import type { items, tags, flashcards } from "@/db/schema";

// DB-level types (source of truth)
export type DbItem = typeof items.$inferSelect;
export type DbTag = typeof tags.$inferSelect;

// App-level types with joined tags
type BaseItem = Omit<DbItem, "type" | "read"> & {
  tags: DbTag[];
  flashcardCount: number;
};

export type ReadingListItem = BaseItem & {
  type: "reading-list";
  read: boolean;
  readAt: string | null;
};

export type Item = ReadingListItem;

// Flashcard type
export type Flashcard = typeof flashcards.$inferSelect;

// Type guard
export function isReadingListItem(item: Item): item is ReadingListItem {
  return item.type === "reading-list";
}
