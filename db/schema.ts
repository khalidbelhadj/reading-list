import { relations, sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  unique,
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

export const tags = pgTable(
  "tags",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    name: text("name").notNull(),
  },
  (table) => [
    unique("tags_user_id_name_unique").on(table.userId, table.name),
    index("tags_user_id_idx").on(table.userId),
  ],
);

export const itemsTags = pgTable(
  "items_tags",
  {
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.itemId, table.tagId] })],
);

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

export const reviewSessions = pgTable(
  "review_sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    mode: text("mode").notNull(),
    scope: jsonb("scope"),
    cardIds: jsonb("card_ids").$type<string[]>().notNull().default([]),
    cardsPlanned: integer("cards_planned").notNull().default(0),
    cardsCompleted: integer("cards_completed").notNull().default(0),
    affectsSchedule: boolean("affects_schedule").notNull().default(true),
    startedAt: timestamp("started_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    index("review_sessions_user_started_idx").on(table.userId, table.startedAt),
  ],
);

export const cardReviews = pgTable(
  "card_reviews",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    sessionId: text("session_id")
      .notNull()
      .references(() => reviewSessions.id),
    flashcardId: text("flashcard_id")
      .notNull()
      .references(() => flashcards.id, { onDelete: "cascade" }),
    rating: text("rating").notNull(),
    durationMs: integer("duration_ms").notNull(),
    timeToRevealMs: integer("time_to_reveal_ms"),
    prevState: text("prev_state").notNull(),
    prevInterval: integer("prev_interval").notNull(),
    prevEaseFactor: real("prev_ease_factor").notNull(),
    prevReps: integer("prev_reps").notNull(),
    nextState: text("next_state").notNull(),
    nextInterval: integer("next_interval").notNull(),
    nextEaseFactor: real("next_ease_factor").notNull(),
    nextDue: timestamp("next_due", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    reviewedAt: timestamp("reviewed_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
  },
  (table) => [
    index("card_reviews_user_reviewed_idx").on(table.userId, table.reviewedAt),
    index("card_reviews_flashcard_idx").on(table.flashcardId),
    index("card_reviews_session_idx").on(table.sessionId),
  ],
);

// Extracted content for an item — one row per item, written by the extraction
// pipeline (lib/extract/). The row doubles as its own job record: status +
// attempts + nextRetryAt drive the worker's claim query, so there is no
// separate queue table. `source` enforces producer precedence (live capture
// from the in-app viewer beats a server-side fetch — see
// lib/extract/worker.server.ts); `extractorVersion` is provenance only —
// re-extraction is manual via the reextractItem action.
export const itemContent = pgTable(
  "item_content",
  {
    itemId: text("item_id")
      .primaryKey()
      .references(() => items.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    status: text("status").notNull().default("pending"),
    source: text("source"),
    extractor: text("extractor"),
    extractorVersion: integer("extractor_version").notNull().default(0),
    contentHash: text("content_hash"),
    title: text("title"),
    markdown: text("markdown"),
    wordCount: integer("word_count"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    nextRetryAt: timestamp("next_retry_at", {
      withTimezone: true,
      mode: "string",
    }),
    // Item-level embedding: normalized mean of the chunk vectors. Null until
    // the embed step succeeds; embeddingError records why it hasn't.
    embedding: vector("embedding", { dimensions: 1536 }),
    embeddingModel: text("embedding_model"),
    embeddingError: text("embedding_error"),
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
    index("item_content_user_idx").on(table.userId),
    index("item_content_claim_idx").on(table.status, table.nextRetryAt),
  ],
);

// Chunked text + embeddings for semantic search. Deterministic ids
// ("<itemId>#<index>") keep re-embeds idempotent without a sequence. The HNSW
// index lives in db/setup.sql (push doesn't manage vector indexes).
export const itemChunks = pgTable(
  "item_chunks",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    text: text("text").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    model: text("model").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
  },
  (table) => [
    unique("item_chunks_item_idx_unique").on(table.itemId, table.chunkIndex),
    index("item_chunks_user_idx").on(table.userId),
  ],
);

// App-global key/value settings — currently just the active embedding
// selection (id = 'embedding'). Deliberately NOT user-scoped: the extraction
// worker runs across all users on the owner connection, and one HNSW index
// covers every row, so the embedding model has to be a single global fact.
// No `authenticated` grant in db/setup.sql: it is reached only through the
// owner connection, so there is no RLS policy to get wrong.
export const appSettings = pgTable("app_settings", {
  id: text("id").primaryKey(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .notNull()
    .default(sql`now()`),
});

export const userSettings = pgTable("user_settings", {
  userId: uuid("user_id").primaryKey(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .notNull()
    .default(sql`now()`),
});

export const reviewEvents = pgTable(
  "review_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id").notNull(),
    sessionId: text("session_id")
      .notNull()
      .references(() => reviewSessions.id),
    flashcardId: text("flashcard_id").references(() => flashcards.id, {
      onDelete: "set null",
    }),
    type: text("type").notNull(),
    data: jsonb("data"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
  },
  (table) => [index("review_events_session_idx").on(table.sessionId)],
);

export const itemsRelations = relations(items, ({ many }) => ({
  itemsTags: many(itemsTags),
  flashcards: many(flashcards),
}));

export const flashcardsRelations = relations(flashcards, ({ one, many }) => ({
  item: one(items, { fields: [flashcards.itemId], references: [items.id] }),
  reviews: many(cardReviews),
}));

export const reviewSessionsRelations = relations(
  reviewSessions,
  ({ many }) => ({
    reviews: many(cardReviews),
    events: many(reviewEvents),
  }),
);

export const cardReviewsRelations = relations(cardReviews, ({ one }) => ({
  session: one(reviewSessions, {
    fields: [cardReviews.sessionId],
    references: [reviewSessions.id],
  }),
  flashcard: one(flashcards, {
    fields: [cardReviews.flashcardId],
    references: [flashcards.id],
  }),
}));

export const reviewEventsRelations = relations(reviewEvents, ({ one }) => ({
  session: one(reviewSessions, {
    fields: [reviewEvents.sessionId],
    references: [reviewSessions.id],
  }),
  flashcard: one(flashcards, {
    fields: [reviewEvents.flashcardId],
    references: [flashcards.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  itemsTags: many(itemsTags),
}));

export const itemsTagsRelations = relations(itemsTags, ({ one }) => ({
  item: one(items, { fields: [itemsTags.itemId], references: [items.id] }),
  tag: one(tags, { fields: [itemsTags.tagId], references: [tags.id] }),
}));
