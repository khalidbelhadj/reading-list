import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
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
    type: text("type").notNull().default("reading-list"),
    starred: boolean("starred").notNull().default(false),
    notes: text("notes"),
    read: boolean("read").notNull().default(false),
    readAt: timestamp("read_at", { withTimezone: true, mode: "string" }),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
  },
  (table) => [index("items_user_type_position_idx").on(table.userId, table.type, table.position)],
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
      .references(() => items.id),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id),
  },
  (table) => [primaryKey({ columns: [table.itemId, table.tagId] })],
);

export const flashcards = pgTable(
  "flashcards",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    itemId: text("item_id").references(() => items.id),
    front: text("front").notNull(),
    back: text("back").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
  },
  (table) => [index("flashcards_user_item_idx").on(table.userId, table.itemId)],
);

export const itemsRelations = relations(items, ({ many }) => ({
  itemsTags: many(itemsTags),
  flashcards: many(flashcards),
}));

export const flashcardsRelations = relations(flashcards, ({ one }) => ({
  item: one(items, { fields: [flashcards.itemId], references: [items.id] }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  itemsTags: many(itemsTags),
}));

export const itemsTagsRelations = relations(itemsTags, ({ one }) => ({
  item: one(items, { fields: [itemsTags.itemId], references: [items.id] }),
  tag: one(tags, { fields: [itemsTags.tagId], references: [tags.id] }),
}));
