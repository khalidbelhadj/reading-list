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

export const itemsRelations = relations(items, ({ many }) => ({
  flashcards: many(flashcards),
}));

export const flashcardsRelations = relations(flashcards, ({ one }) => ({
  item: one(items, { fields: [flashcards.itemId], references: [items.id] }),
}));
