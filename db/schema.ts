import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

export const items = pgTable(
  "items",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    faviconUrl: text("favicon_url"),
    previewImageUrl: text("preview_image_url"),
    starred: boolean("starred").notNull().default(false),
    notes: text("notes"),
    read: boolean("read").notNull().default(false),
    readAt: timestamp("read_at", { withTimezone: true, mode: "string" }),
    hiddenFromReview: boolean("hidden_from_review").notNull().default(false),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
  },
  (table) => [
    index("items_user_created_idx").on(table.userId, table.createdAt),
  ],
);

// Flashcards carry their own SRS scheduling state — rating a card updates
// this row directly (app/actions/review.ts); there are no session or
// history tables.
export const flashcards = pgTable(
  "flashcards",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    itemId: text("item_id").references(() => items.id, { onDelete: "cascade" }),
    front: text("front").notNull(),
    back: text("back").notNull(),
    state: text("state").notNull().default("new"),
    due: timestamp("due", { withTimezone: true, mode: "string" })
      .notNull()
      .default(sql`now()`),
    interval: integer("interval").notNull().default(0),
    easeFactor: real("ease_factor").notNull().default(2.5),
    reps: integer("reps").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    lastReviewedAt: timestamp("last_reviewed_at", {
      withTimezone: true,
      mode: "string",
    }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
  },
  (table) => [
    index("flashcards_user_item_idx").on(table.userId, table.itemId),
    index("flashcards_user_state_due_idx").on(
      table.userId,
      table.state,
      table.due,
    ),
  ],
);

export const userSettings = pgTable("user_settings", {
  userId: uuid("user_id").primaryKey(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .notNull()
    .default(sql`now()`),
});

// The index (lib/index/*, built by the client worker in lib/index-worker):
// one content row per linked item, holding the extracted markdown and
// doubling as the extraction job (status + retry bookkeeping), plus the
// chunks that carry embeddings. Chunks come from three sources — the
// extracted content, the item's own notes, and each flashcard — so semantic
// search covers what was read, what was written, and what is being learned.
// Both tables are best-effort and disposable: dropping them loses nothing
// the app needs to function.
export const CONTENT_STATUSES = [
  "pending",
  "ok",
  "failed",
  "unsupported",
] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const itemContent = pgTable(
  "item_content",
  {
    itemId: text("item_id")
      .primaryKey()
      .references(() => items.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    status: text("status").$type<ContentStatus>().notNull().default("pending"),
    // The url that was (or is being) extracted; a changed item url reopens
    // the job.
    sourceUrl: text("source_url").notNull(),
    extractor: text("extractor"),
    extractorVersion: integer("extractor_version").notNull().default(0),
    contentHash: text("content_hash"),
    title: text("title"),
    markdown: text("markdown"),
    wordCount: integer("word_count").notNull().default(0),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    nextRetryAt: timestamp("next_retry_at", {
      withTimezone: true,
      mode: "string",
    }),
    // Short lease taken by whichever client is running the job, so two open
    // windows don't extract the same item twice.
    claimedUntil: timestamp("claimed_until", {
      withTimezone: true,
      mode: "string",
    }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
  },
  (table) => [
    index("item_content_user_status_idx").on(table.userId, table.status),
  ],
);

export const CHUNK_KINDS = ["content", "notes", "card"] as const;
export type ChunkKind = (typeof CHUNK_KINDS)[number];

// Embedding width: nomic-embed-text v1.5 (lib/index-worker/embed.ts).
export const EMBEDDING_DIMENSIONS = 768;

export const chunks = pgTable(
  "chunks",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    itemId: text("item_id").references(() => items.id, { onDelete: "cascade" }),
    flashcardId: text("flashcard_id").references(() => flashcards.id, {
      onDelete: "cascade",
    }),
    kind: text("kind").$type<ChunkKind>().notNull(),
    ordinal: integer("ordinal").notNull().default(0),
    heading: text("heading"),
    text: text("text").notNull(),
    // Hash of the source text: an unchanged notes/card body keeps its
    // embedding across re-syncs instead of being re-embedded.
    contentHash: text("content_hash").notNull(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
    // Which model produced `embedding`; search only ranks chunks embedded by
    // the model it queries with, and the worker re-embeds on mismatch.
    model: text("model"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
  },
  (table) => [
    index("chunks_user_item_idx").on(table.userId, table.itemId),
    index("chunks_user_flashcard_idx").on(table.userId, table.flashcardId),
    index("chunks_user_kind_idx").on(table.userId, table.kind),
  ],
);

export const itemsRelations = relations(items, ({ many }) => ({
  flashcards: many(flashcards),
}));

export const flashcardsRelations = relations(flashcards, ({ one }) => ({
  item: one(items, { fields: [flashcards.itemId], references: [items.id] }),
}));
