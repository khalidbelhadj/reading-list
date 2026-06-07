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
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
  },
  (table) => [index("items_user_created_idx").on(table.userId, table.createdAt)],
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
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
  },
  (table) => [
    index("flashcards_user_item_idx").on(table.userId, table.itemId),
    index("flashcards_user_state_due_idx").on(table.userId, table.state, table.due),
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
    startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [index("review_sessions_user_started_idx").on(table.userId, table.startedAt)],
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
    nextDue: timestamp("next_due", { withTimezone: true, mode: "string" }).notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "string" }).notNull(),
  },
  (table) => [
    index("card_reviews_user_reviewed_idx").on(table.userId, table.reviewedAt),
    index("card_reviews_flashcard_idx").on(table.flashcardId),
    index("card_reviews_session_idx").on(table.sessionId),
  ],
);

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
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
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

export const reviewSessionsRelations = relations(reviewSessions, ({ many }) => ({
  reviews: many(cardReviews),
  events: many(reviewEvents),
}));

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
