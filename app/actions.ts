"use server";

import { db } from "@/db";
import { items, itemsTags, tags, flashcards } from "@/db/schema";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function deleteItem(itemId: string) {
  await db.transaction(async (tx) => {
    const [item] = await tx
      .select({ type: items.type, position: items.position })
      .from(items)
      .where(eq(items.id, itemId));

    await tx.delete(itemsTags).where(eq(itemsTags.itemId, itemId));
    await tx.delete(items).where(eq(items.id, itemId));

    if (item) {
      // Decrement positions for items that were after the deleted one (single query)
      await tx
        .update(items)
        .set({ position: sql`${items.position} - 1` })
        .where(
          and(eq(items.type, item.type), gte(items.position, item.position)),
        );
    }
  });
  revalidatePath("/");
}

async function fetchOembedTitle(url: string): Promise<string | null> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data.title || null;
  } catch {
    return null;
  }
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .trim()
    .replace(/\s+/g, " ");
}

export async function fetchPageTitle(url: string): Promise<string | null> {
  try {
    const parsed = new URL(url);
    const isYouTube = /^(www\.)?(youtube\.com|youtu\.be)$/.test(
      parsed.hostname,
    );
    if (isYouTube) {
      const title = await fetchOembedTitle(url);
      if (title) return title;
    }

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    const ogMatch =
      text.match(
        /<meta[^>]*property=["']og:title["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i,
      ) ||
      text.match(
        /<meta[^>]*content=["']([\s\S]*?)["'][^>]*property=["']og:title["'][^>]*>/i,
      );
    const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const match = ogMatch || titleMatch;
    if (!match) return null;
    return decodeHtmlEntities(match[1]);
  } catch {
    return null;
  }
}

export async function createItem(
  title: string,
  url: string,
  tagNames: string[],
  faviconUrl?: string,
  type: string = "reading-list",
  notes?: string,
  id?: string,
  position?: number,
) {
  const itemId = id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  const insertAt = position ?? 0;

  await db.transaction(async (tx) => {
    // Shift items at or after the insertion point down by 1
    await tx
      .update(items)
      .set({ position: sql`${items.position} + 1` })
      .where(and(eq(items.type, type), gte(items.position, insertAt)));

    await tx.insert(items).values({
      id: itemId,
      title,
      url,
      faviconUrl: faviconUrl ?? null,
      type,
      starred: false,
      notes: notes ?? null,
      position: insertAt,
      createdAt: now,
      updatedAt: now,
    });

    for (const tagName of tagNames) {
      await tx.insert(tags).values({ name: tagName }).onConflictDoNothing();

      const [tag] = await tx.select().from(tags).where(eq(tags.name, tagName));

      if (tag) {
        await tx.insert(itemsTags).values({ itemId, tagId: tag.id });
      }
    }
  });

  revalidatePath("/");
  return itemId;
}

export async function updateItem(
  itemId: string,
  fields: {
    title?: string;
    url?: string;
    faviconUrl?: string;
    type?: string;
    starred?: boolean;
    notes?: string;
    read?: boolean;
    tagNames?: string[];
  },
) {
  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    const set: Record<string, unknown> = { updatedAt: now };
    if (fields.title !== undefined) set.title = fields.title;
    if (fields.url !== undefined) set.url = fields.url;
    if (fields.faviconUrl !== undefined) set.faviconUrl = fields.faviconUrl;
    if (fields.starred !== undefined) set.starred = fields.starred;
    if (fields.notes !== undefined) set.notes = fields.notes;
    if (fields.read !== undefined) set.read = fields.read;

    // Handle type change: move to position 0 in new type, renumber old type
    if (fields.type !== undefined) {
      const [current] = await tx
        .select({ type: items.type })
        .from(items)
        .where(eq(items.id, itemId));

      if (current && fields.type !== current.type) {
        // Shift items in new type down
        await tx
          .update(items)
          .set({ position: sql`${items.position} + 1` })
          .where(eq(items.type, fields.type));
        set.position = 0;
        set.type = fields.type;

        // Update the item first so it's out of the old type
        await tx.update(items).set(set).where(eq(items.id, itemId));

        // Renumber old type
        const oldTypeItems = await tx
          .select({ id: items.id })
          .from(items)
          .where(eq(items.type, current.type))
          .orderBy(asc(items.position));
        for (let i = 0; i < oldTypeItems.length; i++) {
          await tx
            .update(items)
            .set({ position: i })
            .where(eq(items.id, oldTypeItems[i].id));
        }
      } else {
        set.type = fields.type;
        await tx.update(items).set(set).where(eq(items.id, itemId));
      }
    } else {
      await tx.update(items).set(set).where(eq(items.id, itemId));
    }

    if (fields.tagNames !== undefined) {
      const existingLinks = await tx
        .select({ tagId: itemsTags.tagId })
        .from(itemsTags)
        .where(eq(itemsTags.itemId, itemId));
      const existingTagIds = existingLinks.map((l) => l.tagId);

      const newTagIds: number[] = [];
      for (const tagName of fields.tagNames) {
        await tx.insert(tags).values({ name: tagName }).onConflictDoNothing();
        const [tag] = await tx
          .select()
          .from(tags)
          .where(eq(tags.name, tagName));
        if (tag) newTagIds.push(tag.id);
      }

      for (const tagId of existingTagIds) {
        if (!newTagIds.includes(tagId)) {
          await tx
            .delete(itemsTags)
            .where(
              and(eq(itemsTags.itemId, itemId), eq(itemsTags.tagId, tagId)),
            );
        }
      }

      for (const tagId of newTagIds) {
        if (!existingTagIds.includes(tagId)) {
          await tx.insert(itemsTags).values({ itemId, tagId });
        }
      }
    }
  });

  revalidatePath("/");
}

export async function reorderItem(
  itemId: string,
  type: string,
  newPosition: number,
) {
  await db.transaction(async (tx) => {
    const typeItems = await tx
      .select({ id: items.id, position: items.position })
      .from(items)
      .where(eq(items.type, type))
      .orderBy(asc(items.position));

    const currentIndex = typeItems.findIndex((i) => i.id === itemId);
    if (currentIndex === -1) return;

    const [movedItem] = typeItems.splice(currentIndex, 1);
    const clamped = Math.max(0, Math.min(newPosition, typeItems.length));
    typeItems.splice(clamped, 0, movedItem);

    for (let i = 0; i < typeItems.length; i++) {
      if (typeItems[i].position !== i) {
        await tx
          .update(items)
          .set({ position: i })
          .where(eq(items.id, typeItems[i].id));
      }
    }
  });

  revalidatePath("/");
}

export async function toggleRead(itemId: string, read: boolean) {
  const now = new Date().toISOString();
  await db
    .update(items)
    .set({ read, readAt: read ? now : null, updatedAt: now })
    .where(eq(items.id, itemId));
  revalidatePath("/");
}

export async function bulkDeleteItems(itemIds: string[]) {
  if (itemIds.length === 0) return;

  await db.transaction(async (tx) => {
    // Find affected types before deleting
    const affectedItems = await tx
      .select({ type: items.type })
      .from(items)
      .where(inArray(items.id, itemIds));
    const affectedTypes = Array.from(new Set(affectedItems.map((i) => i.type)));

    // Delete tag links and items
    await tx.delete(itemsTags).where(inArray(itemsTags.itemId, itemIds));
    await tx.delete(items).where(inArray(items.id, itemIds));

    // Renumber positions per affected type (single query each)
    for (const type of affectedTypes) {
      await tx.execute(sql`
        UPDATE ${items} SET position = sub.new_pos
        FROM (
          SELECT id, ROW_NUMBER() OVER (ORDER BY position) - 1 AS new_pos
          FROM ${items} WHERE type = ${type}
        ) sub
        WHERE ${items}.id = sub.id
      `);
    }
  });

  revalidatePath("/");
}

export async function bulkMoveItems(itemIds: string[], newType: string) {
  if (itemIds.length === 0) return;

  await db.transaction(async (tx) => {
    // Find source types
    const sourceItems = await tx
      .select({ id: items.id, type: items.type })
      .from(items)
      .where(inArray(items.id, itemIds));
    const sourceTypes = Array.from(new Set(sourceItems.map((i) => i.type)));

    // Shift existing items in target type to make room
    await tx
      .update(items)
      .set({ position: sql`${items.position} + ${itemIds.length}` })
      .where(eq(items.type, newType));

    // Move items to new type with positions 0..n-1
    const now = new Date().toISOString();
    for (let i = 0; i < itemIds.length; i++) {
      await tx
        .update(items)
        .set({ type: newType, position: i, updatedAt: now })
        .where(eq(items.id, itemIds[i]));
    }

    // Renumber source types
    for (const type of sourceTypes) {
      if (type === newType) continue;
      const remaining = await tx
        .select({ id: items.id })
        .from(items)
        .where(eq(items.type, type))
        .orderBy(asc(items.position));
      for (let i = 0; i < remaining.length; i++) {
        await tx
          .update(items)
          .set({ position: i })
          .where(eq(items.id, remaining[i].id));
      }
    }
  });

  revalidatePath("/");
}

export async function bulkTag(itemIds: string[], tagNames: string[]) {
  if (itemIds.length === 0 || tagNames.length === 0) return;

  await db.transaction(async (tx) => {
    for (const tagName of tagNames) {
      await tx.insert(tags).values({ name: tagName }).onConflictDoNothing();
      const [tag] = await tx.select().from(tags).where(eq(tags.name, tagName));
      if (!tag) continue;
      for (const itemId of itemIds) {
        await tx
          .insert(itemsTags)
          .values({ itemId, tagId: tag.id })
          .onConflictDoNothing();
      }
    }
  });

  revalidatePath("/");
}

export async function bulkMarkRead(itemIds: string[], read: boolean) {
  if (itemIds.length === 0) return;

  const now = new Date().toISOString();
  await db
    .update(items)
    .set({ read, readAt: read ? now : null, updatedAt: now })
    .where(inArray(items.id, itemIds));

  revalidatePath("/");
}

// Flashcard actions

export async function getFlashcardCounts(): Promise<Map<string, number>> {
  const rows = await db
    .select({
      itemId: flashcards.itemId,
      count: sql<number>`count(*)::int`,
    })
    .from(flashcards)
    .groupBy(flashcards.itemId);
  return new Map(rows.filter((r) => r.itemId !== null).map((r) => [r.itemId!, r.count]));
}

export async function getFlashcards(itemId: string) {
  return db
    .select()
    .from(flashcards)
    .where(eq(flashcards.itemId, itemId))
    .orderBy(desc(flashcards.createdAt));
}

export async function getAllFlashcards() {
  return db
    .select({
      id: flashcards.id,
      front: flashcards.front,
      back: flashcards.back,
      itemId: flashcards.itemId,
      itemTitle: items.title,
      itemUrl: items.url,
      itemFaviconUrl: items.faviconUrl,
      createdAt: flashcards.createdAt,
      updatedAt: flashcards.updatedAt,
    })
    .from(flashcards)
    .leftJoin(items, eq(flashcards.itemId, items.id))
    .orderBy(desc(flashcards.createdAt));
}

export async function createFlashcard(
  itemId: string,
  front: string,
  back: string,
) {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.insert(flashcards).values({
    id,
    itemId,
    front,
    back,
    createdAt: now,
    updatedAt: now,
  });
  return { id, itemId, front, back, createdAt: now, updatedAt: now };
}

export async function updateFlashcard(
  id: string,
  fields: { front?: string; back?: string },
) {
  const now = new Date().toISOString();
  const set: Record<string, unknown> = { updatedAt: now };
  if (fields.front !== undefined) set.front = fields.front;
  if (fields.back !== undefined) set.back = fields.back;
  await db.update(flashcards).set(set).where(eq(flashcards.id, id));
}

export async function deleteFlashcard(id: string) {
  await db.delete(flashcards).where(eq(flashcards.id, id));
}
