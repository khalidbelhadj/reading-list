import type { items } from "@/db/schema";

// DB-level types (source of truth)
type DbItem = typeof items.$inferSelect;

// App-level item shape.
//
// previewImageUrl is intentionally omitted: it stores base64 PDF first-page
// renders (avg ~16KB, up to ~63KB per row) that made up ~94% of the items
// payload. It's only used by the preview-density thumbnail, so it's fetched
// separately and lazily via fetchItemPreviews / the ["item-previews"] query.
export type Item = Omit<DbItem, "previewImageUrl"> & {
  flashcardCount: number;
};
