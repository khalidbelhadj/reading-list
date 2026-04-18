"use server";

import { withUser } from "@/db";
import { items, itemsTags, tags, flashcards } from "@/db/schema";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";

export async function deleteItem(itemId: string) {
  const userId = await getCurrentUserId();
  await withUser(userId, async (tx) => {
    const [item] = await tx
      .select({ type: items.type, position: items.position })
      .from(items)
      .where(and(eq(items.id, itemId), eq(items.userId, userId)));

    if (!item) return;

    await tx
      .delete(itemsTags)
      .where(
        inArray(
          itemsTags.itemId,
          tx
            .select({ id: items.id })
            .from(items)
            .where(and(eq(items.id, itemId), eq(items.userId, userId))),
        ),
      );
    await tx
      .delete(flashcards)
      .where(and(eq(flashcards.itemId, itemId), eq(flashcards.userId, userId)));
    await tx
      .delete(items)
      .where(and(eq(items.id, itemId), eq(items.userId, userId)));

    await tx
      .update(items)
      .set({ position: sql`${items.position} - 1` })
      .where(
        and(
          eq(items.userId, userId),
          eq(items.type, item.type),
          gte(items.position, item.position),
        ),
      );
  });
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
  const userId = await getCurrentUserId();
  const itemId = id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  const insertAt = position ?? 0;

  await withUser(userId, async (tx) => {
    // Shift items at or after the insertion point down by 1 — scoped to this user's items.
    await tx
      .update(items)
      .set({ position: sql`${items.position} + 1` })
      .where(
        and(
          eq(items.userId, userId),
          eq(items.type, type),
          gte(items.position, insertAt),
        ),
      );

    await tx.insert(items).values({
      id: itemId,
      userId,
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
      await tx
        .insert(tags)
        .values({ userId, name: tagName })
        .onConflictDoNothing();

      const [tag] = await tx
        .select()
        .from(tags)
        .where(and(eq(tags.userId, userId), eq(tags.name, tagName)));

      if (tag) {
        await tx.insert(itemsTags).values({ itemId, tagId: tag.id });
      }
    }
  });

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
  const userId = await getCurrentUserId();
  const now = new Date().toISOString();

  await withUser(userId, async (tx) => {
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
        .where(and(eq(items.id, itemId), eq(items.userId, userId)));

      if (current && fields.type !== current.type) {
        // Shift items in new type down — user-scoped.
        await tx
          .update(items)
          .set({ position: sql`${items.position} + 1` })
          .where(and(eq(items.userId, userId), eq(items.type, fields.type)));
        set.position = 0;
        set.type = fields.type;

        await tx
          .update(items)
          .set(set)
          .where(and(eq(items.id, itemId), eq(items.userId, userId)));

        // Renumber old type — user-scoped.
        const oldTypeItems = await tx
          .select({ id: items.id })
          .from(items)
          .where(and(eq(items.userId, userId), eq(items.type, current.type)))
          .orderBy(asc(items.position));
        for (let i = 0; i < oldTypeItems.length; i++) {
          await tx
            .update(items)
            .set({ position: i })
            .where(
              and(eq(items.id, oldTypeItems[i].id), eq(items.userId, userId)),
            );
        }
      } else {
        set.type = fields.type;
        await tx
          .update(items)
          .set(set)
          .where(and(eq(items.id, itemId), eq(items.userId, userId)));
      }
    } else {
      await tx
        .update(items)
        .set(set)
        .where(and(eq(items.id, itemId), eq(items.userId, userId)));
    }

    if (fields.tagNames !== undefined) {
      // Verify ownership of the item before mutating tag links.
      const [owned] = await tx
        .select({ id: items.id })
        .from(items)
        .where(and(eq(items.id, itemId), eq(items.userId, userId)));
      if (!owned) return;

      const existingLinks = await tx
        .select({ tagId: itemsTags.tagId })
        .from(itemsTags)
        .where(eq(itemsTags.itemId, itemId));
      const existingTagIds = existingLinks.map((l) => l.tagId);

      const newTagIds: number[] = [];
      for (const tagName of fields.tagNames) {
        await tx
          .insert(tags)
          .values({ userId, name: tagName })
          .onConflictDoNothing();
        const [tag] = await tx
          .select()
          .from(tags)
          .where(and(eq(tags.userId, userId), eq(tags.name, tagName)));
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

}

export async function reorderItem(
  itemId: string,
  type: string,
  newPosition: number,
) {
  const userId = await getCurrentUserId();
  await withUser(userId, async (tx) => {
    const typeItems = await tx
      .select({ id: items.id, position: items.position })
      .from(items)
      .where(and(eq(items.userId, userId), eq(items.type, type)))
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
          .where(
            and(eq(items.id, typeItems[i].id), eq(items.userId, userId)),
          );
      }
    }
  });

}

export async function toggleRead(itemId: string, read: boolean) {
  const userId = await getCurrentUserId();
  const now = new Date().toISOString();
  await withUser(userId, async (tx) => {
    await tx
      .update(items)
      .set({ read, readAt: read ? now : null, updatedAt: now })
      .where(and(eq(items.id, itemId), eq(items.userId, userId)));
  });
}

export async function bulkDeleteItems(itemIds: string[]) {
  if (itemIds.length === 0) return;

  const userId = await getCurrentUserId();
  await withUser(userId, async (tx) => {
    // Find affected types, ownership-filtered.
    const affectedItems = await tx
      .select({ id: items.id, type: items.type })
      .from(items)
      .where(and(inArray(items.id, itemIds), eq(items.userId, userId)));
    const ownedIds = affectedItems.map((i) => i.id);
    if (ownedIds.length === 0) return;
    const affectedTypes = Array.from(new Set(affectedItems.map((i) => i.type)));

    await tx.delete(itemsTags).where(inArray(itemsTags.itemId, ownedIds));
    await tx
      .delete(flashcards)
      .where(
        and(
          inArray(flashcards.itemId, ownedIds),
          eq(flashcards.userId, userId),
        ),
      );
    await tx
      .delete(items)
      .where(and(inArray(items.id, ownedIds), eq(items.userId, userId)));

    for (const type of affectedTypes) {
      await tx.execute(sql`
        UPDATE ${items} SET position = sub.new_pos
        FROM (
          SELECT id, ROW_NUMBER() OVER (ORDER BY position) - 1 AS new_pos
          FROM ${items}
          WHERE type = ${type} AND user_id = ${userId}
        ) sub
        WHERE ${items}.id = sub.id
      `);
    }
  });

}

export async function bulkMoveItems(itemIds: string[], newType: string) {
  if (itemIds.length === 0) return;

  const userId = await getCurrentUserId();
  await withUser(userId, async (tx) => {
    // Ownership-filtered source items.
    const sourceItems = await tx
      .select({ id: items.id, type: items.type })
      .from(items)
      .where(and(inArray(items.id, itemIds), eq(items.userId, userId)));
    const ownedIds = sourceItems.map((i) => i.id);
    if (ownedIds.length === 0) return;
    const sourceTypes = Array.from(new Set(sourceItems.map((i) => i.type)));

    // Shift existing items in target type — user-scoped.
    await tx
      .update(items)
      .set({ position: sql`${items.position} + ${ownedIds.length}` })
      .where(and(eq(items.userId, userId), eq(items.type, newType)));

    const now = new Date().toISOString();
    for (let i = 0; i < ownedIds.length; i++) {
      await tx
        .update(items)
        .set({ type: newType, position: i, updatedAt: now })
        .where(and(eq(items.id, ownedIds[i]), eq(items.userId, userId)));
    }

    for (const type of sourceTypes) {
      if (type === newType) continue;
      const remaining = await tx
        .select({ id: items.id })
        .from(items)
        .where(and(eq(items.userId, userId), eq(items.type, type)))
        .orderBy(asc(items.position));
      for (let i = 0; i < remaining.length; i++) {
        await tx
          .update(items)
          .set({ position: i })
          .where(and(eq(items.id, remaining[i].id), eq(items.userId, userId)));
      }
    }
  });

}

export async function bulkTag(itemIds: string[], tagNames: string[]) {
  if (itemIds.length === 0 || tagNames.length === 0) return;

  const userId = await getCurrentUserId();
  await withUser(userId, async (tx) => {
    // Filter to owned items only.
    const owned = await tx
      .select({ id: items.id })
      .from(items)
      .where(and(inArray(items.id, itemIds), eq(items.userId, userId)));
    const ownedIds = owned.map((i) => i.id);
    if (ownedIds.length === 0) return;

    for (const tagName of tagNames) {
      await tx
        .insert(tags)
        .values({ userId, name: tagName })
        .onConflictDoNothing();
      const [tag] = await tx
        .select()
        .from(tags)
        .where(and(eq(tags.userId, userId), eq(tags.name, tagName)));
      if (!tag) continue;
      for (const itemId of ownedIds) {
        await tx
          .insert(itemsTags)
          .values({ itemId, tagId: tag.id })
          .onConflictDoNothing();
      }
    }
  });

}

export async function bulkMarkRead(itemIds: string[], read: boolean) {
  if (itemIds.length === 0) return;

  const userId = await getCurrentUserId();
  const now = new Date().toISOString();
  await withUser(userId, async (tx) => {
    await tx
      .update(items)
      .set({ read, readAt: read ? now : null, updatedAt: now })
      .where(and(inArray(items.id, itemIds), eq(items.userId, userId)));
  });

}

// Flashcard actions

export async function renameTag(tagId: number, newName: string) {
  const userId = await getCurrentUserId();
  const trimmed = newName.trim().toLowerCase();
  if (!trimmed) return;
  await withUser(userId, async (tx) => {
    const [tag] = await tx
      .select({ id: tags.id, name: tags.name })
      .from(tags)
      .where(and(eq(tags.id, tagId), eq(tags.userId, userId)));
    if (!tag || tag.name === trimmed) return;

    const [existing] = await tx
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.userId, userId), eq(tags.name, trimmed)));

    if (existing) {
      // Merge: move items_tags rows onto the existing tag, then drop the
      // source. ON CONFLICT DO NOTHING handles items already tagged with
      // both names.
      await tx.execute(sql`
        INSERT INTO items_tags (item_id, tag_id)
        SELECT item_id, ${existing.id}
        FROM items_tags
        WHERE tag_id = ${tagId}
        ON CONFLICT DO NOTHING
      `);
      await tx.delete(itemsTags).where(eq(itemsTags.tagId, tagId));
      await tx.delete(tags).where(and(eq(tags.id, tagId), eq(tags.userId, userId)));
    } else {
      await tx
        .update(tags)
        .set({ name: trimmed })
        .where(and(eq(tags.id, tagId), eq(tags.userId, userId)));
    }
  });
}

export async function deleteTag(tagId: number) {
  const userId = await getCurrentUserId();
  await withUser(userId, async (tx) => {
    await tx.delete(itemsTags).where(eq(itemsTags.tagId, tagId));
    await tx.delete(tags).where(and(eq(tags.id, tagId), eq(tags.userId, userId)));
  });
}

export async function getFlashcardCounts(): Promise<Map<string, number>> {
  const userId = await getCurrentUserId();
  const rows = await withUser(userId, (tx) =>
    tx
      .select({
        itemId: flashcards.itemId,
        count: sql<number>`count(*)::int`,
      })
      .from(flashcards)
      .where(eq(flashcards.userId, userId))
      .groupBy(flashcards.itemId),
  );
  return new Map(
    rows.filter((r) => r.itemId !== null).map((r) => [r.itemId!, r.count]),
  );
}

export async function getFlashcards(itemId: string) {
  const userId = await getCurrentUserId();
  return withUser(userId, (tx) =>
    tx
      .select()
      .from(flashcards)
      .where(
        and(eq(flashcards.itemId, itemId), eq(flashcards.userId, userId)),
      )
      .orderBy(desc(flashcards.createdAt)),
  );
}

export async function getAllFlashcards() {
  const userId = await getCurrentUserId();
  return withUser(userId, (tx) =>
    tx
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
      .leftJoin(
        items,
        and(eq(flashcards.itemId, items.id), eq(items.userId, userId)),
      )
      .where(eq(flashcards.userId, userId))
      .orderBy(desc(flashcards.createdAt)),
  );
}

export async function createFlashcard(
  itemId: string,
  front: string,
  back: string,
) {
  const userId = await getCurrentUserId();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  return withUser(userId, async (tx) => {
    // Verify the item belongs to this user before linking a flashcard to it.
    const [owned] = await tx
      .select({ id: items.id })
      .from(items)
      .where(and(eq(items.id, itemId), eq(items.userId, userId)));
    if (!owned) throw new Error("Item not found");

    await tx.insert(flashcards).values({
      id,
      userId,
      itemId,
      front,
      back,
      createdAt: now,
      updatedAt: now,
    });
    return { id, itemId, front, back, createdAt: now, updatedAt: now };
  });
}

export async function updateFlashcard(
  id: string,
  fields: { front?: string; back?: string },
) {
  const userId = await getCurrentUserId();
  const now = new Date().toISOString();
  const set: Record<string, unknown> = { updatedAt: now };
  if (fields.front !== undefined) set.front = fields.front;
  if (fields.back !== undefined) set.back = fields.back;
  await withUser(userId, (tx) =>
    tx
      .update(flashcards)
      .set(set)
      .where(and(eq(flashcards.id, id), eq(flashcards.userId, userId))),
  );
}

export async function deleteFlashcard(id: string) {
  const userId = await getCurrentUserId();
  await withUser(userId, (tx) =>
    tx
      .delete(flashcards)
      .where(and(eq(flashcards.id, id), eq(flashcards.userId, userId))),
  );
}
