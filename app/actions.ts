"use server";

import { db } from "@/db";
import { items, tags, itemsTags } from "@/db/schema";
import { eq, and, asc, sql, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function deleteItem(itemId: string) {
  await db.transaction(async (tx) => {
    const [item] = await tx
      .select({ type: items.type })
      .from(items)
      .where(eq(items.id, itemId));

    await tx.delete(itemsTags).where(eq(itemsTags.itemId, itemId));
    await tx.delete(items).where(eq(items.id, itemId));

    if (item) {
      const remaining = await tx
        .select({ id: items.id })
        .from(items)
        .where(eq(items.type, item.type))
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

export async function fetchPageTitle(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ReadingList/1.0)" },
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    const match = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!match) return null;
    return match[1]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .trim()
      .replace(/\s+/g, " ");
  } catch {
    return null;
  }
}

export async function createItem(title: string, url: string, tagNames: string[], faviconUrl?: string, type: string = "bookmark", notes?: string) {
  const itemId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    await tx
      .update(items)
      .set({ position: sql`${items.position} + 1` })
      .where(eq(items.type, type));

    await tx.insert(items).values({
      id: itemId,
      title,
      url,
      faviconUrl: faviconUrl ?? null,
      type,
      starred: false,
      notes: notes ?? null,
      position: 0,
      createdAt: now,
      updatedAt: now,
    });

    for (const tagName of tagNames) {
      await tx.insert(tags).values({ name: tagName }).onConflictDoNothing();

      const [tag] = await tx
        .select()
        .from(tags)
        .where(eq(tags.name, tagName));

      if (tag) {
        await tx.insert(itemsTags).values({ itemId, tagId: tag.id });
      }
    }
  });

  revalidatePath("/");
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
          await tx.delete(itemsTags).where(
            and(
              eq(itemsTags.itemId, itemId),
              eq(itemsTags.tagId, tagId),
            ),
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

export async function reorderItem(itemId: string, type: string, newPosition: number) {
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
  await db
    .update(items)
    .set({ read, updatedAt: new Date().toISOString() })
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

    // Renumber positions per affected type
    for (const type of affectedTypes) {
      const remaining = await tx
        .select({ id: items.id })
        .from(items)
        .where(eq(items.type, type))
        .orderBy(asc(items.position));
      for (let i = 0; i < remaining.length; i++) {
        await tx.update(items).set({ position: i }).where(eq(items.id, remaining[i].id));
      }
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
        await tx.update(items).set({ position: i }).where(eq(items.id, remaining[i].id));
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
        await tx.insert(itemsTags).values({ itemId, tagId: tag.id }).onConflictDoNothing();
      }
    }
  });

  revalidatePath("/");
}

export async function importBookmarks(html: string) {
  const { parseBookmarksHtml } = await import("@/lib/parse-bookmarks");
  const parsed = parseBookmarksHtml(html);
  if (parsed.length === 0) return { imported: 0 };

  let imported = 0;

  await db.transaction(async (tx) => {
    // Get existing URLs to deduplicate
    const existingItems = await tx
      .select({ url: items.url })
      .from(items)
      .where(eq(items.type, "reading-list"));
    const existingUrls = new Set(existingItems.map((i) => i.url));

    // Get max position in reading-list
    const [maxPos] = await tx
      .select({ max: sql<number>`coalesce(max(${items.position}), -1)` })
      .from(items)
      .where(eq(items.type, "reading-list"));
    let nextPosition = (maxPos?.max ?? -1) + 1;

    const now = new Date().toISOString();

    for (const bookmark of parsed) {
      if (existingUrls.has(bookmark.url)) continue;

      const itemId = crypto.randomUUID();
      await tx.insert(items).values({
        id: itemId,
        title: bookmark.title,
        url: bookmark.url,
        faviconUrl: null,
        type: "reading-list",
        starred: false,
        notes: null,
        read: false,
        position: nextPosition++,
        createdAt: now,
        updatedAt: now,
      });

      for (const tagName of bookmark.tags) {
        await tx.insert(tags).values({ name: tagName }).onConflictDoNothing();
        const [tag] = await tx
          .select()
          .from(tags)
          .where(eq(tags.name, tagName));
        if (tag) {
          await tx
            .insert(itemsTags)
            .values({ itemId, tagId: tag.id })
            .onConflictDoNothing();
        }
      }

      existingUrls.add(bookmark.url);
      imported++;
    }
  });

  revalidatePath("/");
  return { imported };
}

export async function bulkMarkRead(itemIds: string[], read: boolean) {
  if (itemIds.length === 0) return;

  await db
    .update(items)
    .set({ read, updatedAt: new Date().toISOString() })
    .where(inArray(items.id, itemIds));

  revalidatePath("/");
}
