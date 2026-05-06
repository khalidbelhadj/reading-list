"use server";

import { withUser } from "@/db";
import {
  items,
  itemsTags,
  tags,
  flashcards,
  reviewSessions,
  cardReviews,
} from "@/db/schema";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";
import { schedule, type Rating } from "@/lib/srs";
import { logReviewEvent, type ReviewEvent } from "@/lib/review-events";
import { pruneOrphanTags } from "@/lib/tags";
import {
  searchItems as searchItemsQuery,
  searchFlashcards as searchFlashcardsQuery,
  type SearchResult,
  type FlashcardSearchResult,
} from "@/lib/search";

export async function searchItems(query: string): Promise<SearchResult[]> {
  const userId = await getCurrentUserId();
  return withUser(userId, (tx) => searchItemsQuery(tx, userId, query));
}

export async function searchFlashcards(query: string): Promise<FlashcardSearchResult[]> {
  const userId = await getCurrentUserId();
  return withUser(userId, (tx) => searchFlashcardsQuery(tx, userId, query));
}

export async function deleteItem(itemId: string) {
  const userId = await getCurrentUserId();
  await withUser(userId, async (tx) => {
    const [item] = await tx
      .select({ position: items.position })
      .from(items)
      .where(and(eq(items.id, itemId), eq(items.userId, userId)));

    if (!item) return;

    const affectedTagIds = (
      await tx
        .select({ tagId: itemsTags.tagId })
        .from(itemsTags)
        .where(eq(itemsTags.itemId, itemId))
    ).map((r) => r.tagId);

    await tx.delete(itemsTags).where(
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

    await pruneOrphanTags(tx, userId, affectedTagIds);

    await tx
      .update(items)
      .set({ position: sql`${items.position} - 1` })
      .where(
        and(
          eq(items.userId, userId),
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
          gte(items.position, insertAt),
        ),
      );

    await tx.insert(items).values({
      id: itemId,
      userId,
      title,
      url,
      faviconUrl: faviconUrl ?? null,
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
    starred?: boolean;
    notes?: string;
    read?: boolean;
    tagNames?: string[];
  },
) {
  const userId = await getCurrentUserId();
  const now = new Date().toISOString();

  await withUser(userId, async (tx) => {
    // TODO: I'm curious, why do we need this `set`, why not use fields directly?
    const set: Record<string, unknown> = { updatedAt: now };
    if (fields.title !== undefined) set.title = fields.title;
    if (fields.url !== undefined) set.url = fields.url;
    if (fields.faviconUrl !== undefined) set.faviconUrl = fields.faviconUrl;
    if (fields.starred !== undefined) set.starred = fields.starred;
    if (fields.notes !== undefined) set.notes = fields.notes;
    if (fields.read !== undefined) set.read = fields.read;

    await tx
      .update(items)
      .set(set)
      .where(and(eq(items.id, itemId), eq(items.userId, userId)));

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

      const removedTagIds: number[] = [];
      for (const tagId of existingTagIds) {
        if (!newTagIds.includes(tagId)) {
          await tx
            .delete(itemsTags)
            .where(
              and(eq(itemsTags.itemId, itemId), eq(itemsTags.tagId, tagId)),
            );
          removedTagIds.push(tagId);
        }
      }

      for (const tagId of newTagIds) {
        if (!existingTagIds.includes(tagId)) {
          await tx.insert(itemsTags).values({ itemId, tagId });
        }
      }

      await pruneOrphanTags(tx, userId, removedTagIds);
    }
  });
}

export async function reorderItem(
  itemId: string,
  newPosition: number,
) {
  const userId = await getCurrentUserId();
  await withUser(userId, async (tx) => {
    const typeItems = await tx
      .select({ id: items.id, position: items.position })
      .from(items)
      .where(eq(items.userId, userId))
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
          .where(and(eq(items.id, typeItems[i].id), eq(items.userId, userId)));
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
    const affectedItems = await tx
      .select({ id: items.id })
      .from(items)
      .where(and(inArray(items.id, itemIds), eq(items.userId, userId)));
    const ownedIds = affectedItems.map((i) => i.id);
    if (ownedIds.length === 0) return;

    const affectedTagIds = (
      await tx
        .select({ tagId: itemsTags.tagId })
        .from(itemsTags)
        .where(inArray(itemsTags.itemId, ownedIds))
    ).map((r) => r.tagId);

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

    await pruneOrphanTags(tx, userId, affectedTagIds);

    await tx.execute(sql`
      UPDATE ${items} SET position = sub.new_pos
      FROM (
        SELECT id, ROW_NUMBER() OVER (ORDER BY position) - 1 AS new_pos
        FROM ${items}
        WHERE user_id = ${userId}
      ) sub
      WHERE ${items}.id = sub.id
    `);
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
      await tx
        .delete(tags)
        .where(and(eq(tags.id, tagId), eq(tags.userId, userId)));
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
    await tx
      .delete(tags)
      .where(and(eq(tags.id, tagId), eq(tags.userId, userId)));
  });
}

export async function getFlashcards(itemId: string) {
  const userId = await getCurrentUserId();
  return withUser(userId, (tx) =>
    tx
      .select()
      .from(flashcards)
      .where(and(eq(flashcards.itemId, itemId), eq(flashcards.userId, userId)))
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
        state: flashcards.state,
        due: flashcards.due,
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

// Review actions

export type ReviewMode = "due" | "cram" | "item" | "new" | "filter";

export type ReviewScope = {
  itemId?: string;
  tagIds?: number[];
};

type QueueCard = {
  id: string;
  itemId: string | null;
  front: string;
  back: string;
  state: string;
  due: string;
  interval: number;
  easeFactor: number;
  reps: number;
  lapses: number;
  itemTitle: string | null;
  itemUrl: string | null;
  itemFaviconUrl: string | null;
};

const selectQueueCard = {
  id: flashcards.id,
  itemId: flashcards.itemId,
  front: flashcards.front,
  back: flashcards.back,
  state: flashcards.state,
  due: flashcards.due,
  interval: flashcards.interval,
  easeFactor: flashcards.easeFactor,
  reps: flashcards.reps,
  lapses: flashcards.lapses,
  itemTitle: items.title,
  itemUrl: items.url,
  itemFaviconUrl: items.faviconUrl,
};

export async function getDueCards(limit = 5): Promise<QueueCard[]> {
  const userId = await getCurrentUserId();
  const now = new Date().toISOString();
  return withUser(userId, (tx) =>
    tx
      .select(selectQueueCard)
      .from(flashcards)
      .leftJoin(
        items,
        and(eq(flashcards.itemId, items.id), eq(items.userId, userId)),
      )
      .where(and(eq(flashcards.userId, userId), lte(flashcards.due, now)))
      .orderBy(asc(flashcards.due))
      .limit(limit),
  );
}

export async function getNewCards(limit = 5): Promise<QueueCard[]> {
  const userId = await getCurrentUserId();
  return withUser(userId, (tx) =>
    tx
      .select(selectQueueCard)
      .from(flashcards)
      .leftJoin(
        items,
        and(eq(flashcards.itemId, items.id), eq(items.userId, userId)),
      )
      .where(and(eq(flashcards.userId, userId), eq(flashcards.state, "new")))
      .orderBy(asc(flashcards.createdAt))
      .limit(limit),
  );
}

export async function getCardsForItem(itemId: string): Promise<QueueCard[]> {
  const userId = await getCurrentUserId();
  return withUser(userId, (tx) =>
    tx
      .select(selectQueueCard)
      .from(flashcards)
      .leftJoin(
        items,
        and(eq(flashcards.itemId, items.id), eq(items.userId, userId)),
      )
      .where(and(eq(flashcards.userId, userId), eq(flashcards.itemId, itemId)))
      .orderBy(asc(flashcards.createdAt)),
  );
}

export async function getAllCardsForCram(): Promise<QueueCard[]> {
  const userId = await getCurrentUserId();
  return withUser(userId, (tx) =>
    tx
      .select(selectQueueCard)
      .from(flashcards)
      .leftJoin(
        items,
        and(eq(flashcards.itemId, items.id), eq(items.userId, userId)),
      )
      .where(eq(flashcards.userId, userId))
      .orderBy(asc(flashcards.createdAt)),
  );
}

// Strict round-robin interleave: take one card from each item's group in turn.
// Group order is the order items first appear in the input (which the caller
// pre-sorted by due asc, so the most-urgent item leads). Within each group,
// cards are due-asc so the most-overdue card of each item gets shown first.
// Cards with no itemId each get their own bucket so they freely mix.
const interleaveByItem = <T extends { itemId: string | null; due: string }>(
  cards: T[],
): T[] => {
  const groups = new Map<string, T[]>();
  let solo = 0;
  for (const card of cards) {
    const key = card.itemId ?? `__solo__${solo++}`;
    const existing = groups.get(key);
    if (existing) existing.push(card);
    else groups.set(key, [card]);
  }
  const buckets = Array.from(groups.values());
  for (const bucket of buckets) {
    bucket.sort((a, b) => a.due.localeCompare(b.due));
  }

  const result: T[] = [];
  const maxLen = buckets.reduce((m, b) => Math.max(m, b.length), 0);
  for (let i = 0; i < maxLen; i++) {
    for (const bucket of buckets) {
      if (i < bucket.length) result.push(bucket[i]);
    }
  }
  return result;
};

export async function startReviewSession(args: {
  mode: ReviewMode;
  scope?: ReviewScope;
  limit?: number;
}): Promise<{
  sessionId: string;
  cardCount: number;
  data: ReviewSessionData | null;
}> {
  const userId = await getCurrentUserId();
  const sessionId = crypto.randomUUID();
  const now = new Date().toISOString();
  const affectsSchedule = args.mode !== "cram";
  const limit = args.limit ?? 5;

  return withUser(userId, async (tx) => {
    const cardSelection = {
      id: flashcards.id,
      itemId: flashcards.itemId,
      front: flashcards.front,
      back: flashcards.back,
      state: flashcards.state,
      interval: flashcards.interval,
      easeFactor: flashcards.easeFactor,
      reps: flashcards.reps,
      lapses: flashcards.lapses,
      due: flashcards.due,
      itemTitle: items.title,
      itemUrl: items.url,
      itemFaviconUrl: items.faviconUrl,
    };

    let cards: ReviewSessionCard[] = [];

    if (args.mode === "due") {
      cards = await tx
        .select(cardSelection)
        .from(flashcards)
        .leftJoin(
          items,
          and(eq(flashcards.itemId, items.id), eq(items.userId, userId)),
        )
        .where(and(eq(flashcards.userId, userId), lte(flashcards.due, now)))
        .orderBy(asc(flashcards.due))
        .limit(limit);
    } else if (args.mode === "new") {
      cards = await tx
        .select(cardSelection)
        .from(flashcards)
        .leftJoin(
          items,
          and(eq(flashcards.itemId, items.id), eq(items.userId, userId)),
        )
        .where(and(eq(flashcards.userId, userId), eq(flashcards.state, "new")))
        .orderBy(asc(flashcards.createdAt))
        .limit(limit);
    } else if (args.mode === "item") {
      if (!args.scope?.itemId)
        throw new Error("item mode requires scope.itemId");
      cards = await tx
        .select(cardSelection)
        .from(flashcards)
        .leftJoin(
          items,
          and(eq(flashcards.itemId, items.id), eq(items.userId, userId)),
        )
        .where(
          and(
            eq(flashcards.userId, userId),
            eq(flashcards.itemId, args.scope.itemId),
          ),
        )
        .orderBy(asc(flashcards.createdAt));
    } else if (args.mode === "cram") {
      cards = await tx
        .select(cardSelection)
        .from(flashcards)
        .leftJoin(
          items,
          and(eq(flashcards.itemId, items.id), eq(items.userId, userId)),
        )
        .where(eq(flashcards.userId, userId))
        .orderBy(asc(flashcards.createdAt))
        .limit(limit);
    }

    cards = interleaveByItem(cards);
    const cardIds = cards.map((c) => c.id);

    await tx.insert(reviewSessions).values({
      id: sessionId,
      userId,
      mode: args.mode,
      scope: args.scope ?? null,
      cardIds,
      cardsPlanned: cardIds.length,
      cardsCompleted: 0,
      affectsSchedule,
      startedAt: now,
    });

    const data: ReviewSessionData | null = cardIds.length
      ? {
          session: {
            id: sessionId,
            mode: args.mode,
            cardsPlanned: cardIds.length,
            cardsCompleted: 0,
            affectsSchedule,
            startedAt: now,
            endedAt: null,
          },
          cards,
          completedCardIds: [],
        }
      : null;

    return { sessionId, cardCount: cardIds.length, data };
  });
}

export type ReviewSessionCard = {
  id: string;
  itemId: string | null;
  front: string;
  back: string;
  state: string;
  interval: number;
  easeFactor: number;
  reps: number;
  lapses: number;
  due: string;
  itemTitle: string | null;
  itemUrl: string | null;
  itemFaviconUrl: string | null;
};

export type ReviewSessionData = {
  session: {
    id: string;
    mode: string;
    cardsPlanned: number;
    cardsCompleted: number;
    affectsSchedule: boolean;
    startedAt: string;
    endedAt: string | null;
  };
  cards: ReviewSessionCard[];
  completedCardIds: string[];
};

export async function getReviewSession(
  sessionId: string,
): Promise<ReviewSessionData | null> {
  const userId = await getCurrentUserId();
  return withUser(userId, async (tx) => {
    const [session] = await tx
      .select()
      .from(reviewSessions)
      .where(
        and(
          eq(reviewSessions.id, sessionId),
          eq(reviewSessions.userId, userId),
        ),
      );
    if (!session) return null;

    const ids = (session.cardIds ?? []) as string[];
    const cards: ReviewSessionCard[] = ids.length
      ? await tx
          .select({
            id: flashcards.id,
            itemId: flashcards.itemId,
            front: flashcards.front,
            back: flashcards.back,
            state: flashcards.state,
            interval: flashcards.interval,
            easeFactor: flashcards.easeFactor,
            reps: flashcards.reps,
            lapses: flashcards.lapses,
            due: flashcards.due,
            itemTitle: items.title,
            itemUrl: items.url,
            itemFaviconUrl: items.faviconUrl,
          })
          .from(flashcards)
          .leftJoin(
            items,
            and(eq(flashcards.itemId, items.id), eq(items.userId, userId)),
          )
          .where(
            and(eq(flashcards.userId, userId), inArray(flashcards.id, ids)),
          )
      : [];

    const cardsById = new Map(cards.map((c) => [c.id, c]));
    const orderedCards = ids
      .map((id) => cardsById.get(id))
      .filter((c): c is ReviewSessionCard => Boolean(c));

    const completed = await tx
      .select({ flashcardId: cardReviews.flashcardId })
      .from(cardReviews)
      .where(
        and(
          eq(cardReviews.sessionId, sessionId),
          eq(cardReviews.userId, userId),
        ),
      )
      .orderBy(asc(cardReviews.reviewedAt));

    return {
      session: {
        id: session.id,
        mode: session.mode,
        cardsPlanned: session.cardsPlanned,
        cardsCompleted: session.cardsCompleted,
        affectsSchedule: session.affectsSchedule,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
      },
      cards: orderedCards,
      completedCardIds: completed.map((c) => c.flashcardId),
    };
  });
}

export type SessionSummary = {
  mode: string;
  totalCards: number;
  ratedCards: number;
  ratings: { again: number; hard: number; good: number; easy: number };
  totalActiveMs: number;
  wallClockMs: number;
  avgTimeToRevealMs: number | null;
};

export async function getSessionSummary(
  sessionId: string,
): Promise<SessionSummary | null> {
  const userId = await getCurrentUserId();
  return withUser(userId, async (tx) => {
    const [session] = await tx
      .select()
      .from(reviewSessions)
      .where(
        and(
          eq(reviewSessions.id, sessionId),
          eq(reviewSessions.userId, userId),
        ),
      );
    if (!session) return null;

    const reviews = await tx
      .select({
        rating: cardReviews.rating,
        durationMs: cardReviews.durationMs,
        timeToRevealMs: cardReviews.timeToRevealMs,
      })
      .from(cardReviews)
      .where(
        and(
          eq(cardReviews.sessionId, sessionId),
          eq(cardReviews.userId, userId),
        ),
      );

    const ratings = { again: 0, hard: 0, good: 0, easy: 0 };
    let totalActiveMs = 0;
    let revealCount = 0;
    let revealSum = 0;

    for (const r of reviews) {
      if (r.rating === "again") ratings.again++;
      else if (r.rating === "hard") ratings.hard++;
      else if (r.rating === "good") ratings.good++;
      else if (r.rating === "easy") ratings.easy++;
      totalActiveMs += r.durationMs ?? 0;
      if (r.timeToRevealMs != null) {
        revealCount++;
        revealSum += r.timeToRevealMs;
      }
    }

    const endedAt = session.endedAt ?? new Date().toISOString();
    const wallClockMs =
      new Date(endedAt).getTime() - new Date(session.startedAt).getTime();

    return {
      mode: session.mode,
      totalCards: (session.cardIds as string[]).length,
      ratedCards: reviews.length,
      ratings,
      totalActiveMs,
      wallClockMs,
      avgTimeToRevealMs:
        revealCount > 0 ? Math.round(revealSum / revealCount) : null,
    };
  });
}

export async function rateCard(args: {
  sessionId: string;
  flashcardId: string;
  rating: Rating;
  durationMs: number;
  timeToRevealMs: number | null;
}): Promise<void> {
  const userId = await getCurrentUserId();
  const now = new Date().toISOString();

  await withUser(userId, async (tx) => {
    const [session] = await tx
      .select({
        id: reviewSessions.id,
        affectsSchedule: reviewSessions.affectsSchedule,
        endedAt: reviewSessions.endedAt,
      })
      .from(reviewSessions)
      .where(
        and(
          eq(reviewSessions.id, args.sessionId),
          eq(reviewSessions.userId, userId),
        ),
      );
    if (!session) throw new Error("Review session not found");
    if (session.endedAt) throw new Error("Review session already ended");

    const [card] = await tx
      .select()
      .from(flashcards)
      .where(
        and(eq(flashcards.id, args.flashcardId), eq(flashcards.userId, userId)),
      );
    if (!card) throw new Error("Flashcard not found");

    const next = schedule(
      {
        state: card.state as "new" | "learning" | "review" | "relearning",
        interval: card.interval,
        easeFactor: card.easeFactor,
        reps: card.reps,
        lapses: card.lapses,
        due: card.due,
      },
      args.rating,
      now,
    );

    await tx.insert(cardReviews).values({
      id: crypto.randomUUID(),
      userId,
      sessionId: args.sessionId,
      flashcardId: args.flashcardId,
      rating: args.rating,
      durationMs: args.durationMs,
      timeToRevealMs: args.timeToRevealMs,
      prevState: card.state,
      prevInterval: card.interval,
      prevEaseFactor: card.easeFactor,
      prevReps: card.reps,
      nextState: session.affectsSchedule ? next.state : card.state,
      nextInterval: session.affectsSchedule ? next.interval : card.interval,
      nextEaseFactor: session.affectsSchedule
        ? next.easeFactor
        : card.easeFactor,
      nextDue: session.affectsSchedule ? next.due : card.due,
      reviewedAt: now,
    });

    if (session.affectsSchedule) {
      await tx
        .update(flashcards)
        .set({
          state: next.state,
          interval: next.interval,
          easeFactor: next.easeFactor,
          reps: next.reps,
          lapses: next.lapses,
          due: next.due,
          lastReviewedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(flashcards.id, args.flashcardId),
            eq(flashcards.userId, userId),
          ),
        );
    } else {
      await tx
        .update(flashcards)
        .set({ lastReviewedAt: now })
        .where(
          and(
            eq(flashcards.id, args.flashcardId),
            eq(flashcards.userId, userId),
          ),
        );
    }

    await tx
      .update(reviewSessions)
      .set({ cardsCompleted: sql`${reviewSessions.cardsCompleted} + 1` })
      .where(eq(reviewSessions.id, args.sessionId));
  });
}

export async function logSessionEvent(
  sessionId: string,
  event: ReviewEvent,
): Promise<void> {
  const userId = await getCurrentUserId();
  await logReviewEvent(userId, sessionId, event);
}

export async function skipCard(args: {
  sessionId: string;
  flashcardId: string;
  afterReveal: boolean;
  durationMs: number;
}): Promise<void> {
  const userId = await getCurrentUserId();
  await logReviewEvent(userId, args.sessionId, {
    type: "card_skipped",
    flashcardId: args.flashcardId,
    data: { afterReveal: args.afterReveal, durationMs: args.durationMs },
  });
}

export async function endReviewSession(args: {
  sessionId: string;
  reason: "completed" | "user_ended";
}): Promise<void> {
  const userId = await getCurrentUserId();
  const now = new Date().toISOString();

  await withUser(userId, async (tx) => {
    const [session] = await tx
      .select({ endedAt: reviewSessions.endedAt })
      .from(reviewSessions)
      .where(
        and(
          eq(reviewSessions.id, args.sessionId),
          eq(reviewSessions.userId, userId),
        ),
      );
    if (!session) throw new Error("Review session not found");
    if (session.endedAt) return;

    await tx
      .update(reviewSessions)
      .set({ endedAt: now })
      .where(
        and(
          eq(reviewSessions.id, args.sessionId),
          eq(reviewSessions.userId, userId),
        ),
      );
  });

  await logReviewEvent(userId, args.sessionId, {
    type: "session_ended",
    flashcardId: null,
    data: { reason: args.reason },
  });
}

export async function getReviewStatus(): Promise<{
  dueCount: number;
  dueItemCount: number;
  newCount: number;
  newItemCount: number;
  totalCardCount: number;
  totalItemCount: number;
  lastReviewedAt: string | null;
}> {
  const userId = await getCurrentUserId();
  const now = new Date().toISOString();
  const [dueRows, newRows, totalRows, lastRows] = await Promise.all([
    withUser(userId, (tx) =>
      tx
        .select({
          cards: sql<number>`count(*)::int`,
          items: sql<number>`count(distinct ${flashcards.itemId})::int`,
        })
        .from(flashcards)
        .where(and(eq(flashcards.userId, userId), lte(flashcards.due, now))),
    ),
    withUser(userId, (tx) =>
      tx
        .select({
          cards: sql<number>`count(*)::int`,
          items: sql<number>`count(distinct ${flashcards.itemId})::int`,
        })
        .from(flashcards)
        .where(
          and(eq(flashcards.userId, userId), eq(flashcards.state, "new")),
        ),
    ),
    withUser(userId, (tx) =>
      tx
        .select({
          cards: sql<number>`count(*)::int`,
          items: sql<number>`count(distinct ${flashcards.itemId})::int`,
        })
        .from(flashcards)
        .where(eq(flashcards.userId, userId)),
    ),
    withUser(userId, (tx) =>
      tx
        .select({ reviewedAt: cardReviews.reviewedAt })
        .from(cardReviews)
        .where(eq(cardReviews.userId, userId))
        .orderBy(desc(cardReviews.reviewedAt))
        .limit(1),
    ),
  ]);
  return {
    dueCount: dueRows[0]?.cards ?? 0,
    dueItemCount: dueRows[0]?.items ?? 0,
    newCount: newRows[0]?.cards ?? 0,
    newItemCount: newRows[0]?.items ?? 0,
    totalCardCount: totalRows[0]?.cards ?? 0,
    totalItemCount: totalRows[0]?.items ?? 0,
    lastReviewedAt: lastRows[0]?.reviewedAt ?? null,
  };
}
