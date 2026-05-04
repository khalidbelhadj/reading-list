import type { items, tags, flashcards } from "@/db/schema";

// DB-level types (source of truth)
export type DbItem = typeof items.$inferSelect;
export type DbTag = typeof tags.$inferSelect;

// App-level types with joined tags
export type Item = Omit<DbItem, "read"> & {
  tags: DbTag[];
  flashcardCount: number;
  read: boolean;
  readAt: string | null;
};

// Flashcard type
export type Flashcard = typeof flashcards.$inferSelect;
