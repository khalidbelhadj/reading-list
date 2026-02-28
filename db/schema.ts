import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const items = pgTable("items", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  faviconUrl: text("favicon_url"),
  type: text("type").notNull().default("bookmark"),
  starred: boolean("starred").notNull().default(false),
  notes: text("notes"),
  read: boolean("read").notNull().default(false),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
});

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: text("name").unique().notNull(),
});

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

export const itemsRelations = relations(items, ({ many }) => ({
  itemsTags: many(itemsTags),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  itemsTags: many(itemsTags),
}));

export const itemsTagsRelations = relations(itemsTags, ({ one }) => ({
  item: one(items, { fields: [itemsTags.itemId], references: [items.id] }),
  tag: one(tags, { fields: [itemsTags.tagId], references: [tags.id] }),
}));
