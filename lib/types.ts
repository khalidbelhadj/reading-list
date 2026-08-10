import type { items, tags } from "@/db/schema";

// DB-level types (source of truth)
type DbItem = typeof items.$inferSelect;
export type DbTag = typeof tags.$inferSelect;

// App-level types with joined tags.
//
// previewImageUrl is intentionally omitted: it stores base64 PDF first-page
// renders (avg ~16KB, up to ~63KB per row) that made up ~94% of the items
// payload. It's only used by the cozy-view thumbnail, so it's fetched
// separately and lazily via fetchItemPreviews / the ["item-previews"] query.
export type Item = Omit<DbItem, "read" | "previewImageUrl"> & {
  tags: DbTag[];
  flashcardCount: number;
  read: boolean;
  readAt: string | null;
};
