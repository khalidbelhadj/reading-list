import { and, eq, inArray } from "drizzle-orm";

import { type db, type Tx } from "@/db";
import { flashcards } from "@/db/schema";
import {
  normalizeCardIds,
  parseCardsFromNotes,
  type ParsedCard,
} from "@/lib/card-parse";

// Notes is the source of truth for inline flashcards. On notes save we parse
// the markdown for `<card>` blocks (via the robust, fence-aware parser in
// lib/card-parse.ts) and reconcile them against the `flashcards` table: upsert
// by id, hard-delete missing. A mis-parse here would, via the delete pass below,
// drop unrelated cards' SRS history — which is why the parser must not be fooled
// by delimiter-looking text inside code. See lib/card-parse.ts.

export const MAX_CARD_FIELD_LENGTH = 10000;

export { normalizeCardIds, parseCardsFromNotes, type ParsedCard };

export type ExistingCard = { id: string; front: string; back: string };

export type CardDiff = {
  toInsert: { id: string; front: string; back: string }[];
  toUpdate: { id: string; front: string; back: string }[];
  toDelete: string[];
  skippedOversize: string[];
};

// Pure reconciliation of parsed cards against existing DB rows. Assumes ids are
// already normalized (unique, non-null). Rules:
//   - Never persist an empty card: skip creation when both sides are blank;
//     delete the row if an existing card's sides were both cleared.
//   - Skip a card whose front/back exceeds the length limit, leaving any
//     existing row untouched (the editor surfaces the error inline).
//   - Hard-delete rows whose id no longer appears in the notes.
export const diffCards = (
  parsed: ParsedCard[],
  existing: ExistingCard[],
): CardDiff => {
  const existingById = new Map(existing.map((e) => [e.id, e]));
  const seen = new Set<string>();

  const toInsert: CardDiff["toInsert"] = [];
  const toUpdate: CardDiff["toUpdate"] = [];
  const toDelete: string[] = [];
  const skippedOversize: string[] = [];

  for (const card of parsed) {
    if (card.id === null) continue;
    seen.add(card.id);

    const row = existingById.get(card.id);

    if (
      card.front.length > MAX_CARD_FIELD_LENGTH ||
      card.back.length > MAX_CARD_FIELD_LENGTH
    ) {
      skippedOversize.push(card.id);
      continue;
    }

    const isEmpty = card.front === "" && card.back === "";
    if (isEmpty) {
      if (row) toDelete.push(card.id);
      continue;
    }

    if (!row) {
      toInsert.push({ id: card.id, front: card.front, back: card.back });
    } else if (row.front !== card.front || row.back !== card.back) {
      toUpdate.push({ id: card.id, front: card.front, back: card.back });
    }
  }

  for (const row of existing) {
    if (!seen.has(row.id)) toDelete.push(row.id);
  }

  return { toInsert, toUpdate, toDelete, skippedOversize };
};

// Reconcile the `flashcards` rows for one item against its notes. Runs inside
// the caller's `withUser` transaction (RLS + the explicit userId scope below
// enforce ownership). Returns the normalized notes when ids changed, so the
// save action can persist the corrected document in the same write.
export const syncFlashcardsFromNotes = async (
  tx: Tx | typeof db,
  userId: string,
  itemId: string,
  notes: string,
): Promise<{ normalizedNotes: string | null; diff: CardDiff }> => {
  const { notes: normalized, changed } = normalizeCardIds(notes);
  const parsed = parseCardsFromNotes(normalized);

  const existing: ExistingCard[] = await tx
    .select({
      id: flashcards.id,
      front: flashcards.front,
      back: flashcards.back,
    })
    .from(flashcards)
    .where(and(eq(flashcards.itemId, itemId), eq(flashcards.userId, userId)));

  const diff = diffCards(parsed, existing);
  const now = new Date().toISOString();

  if (diff.toInsert.length > 0) {
    await tx.insert(flashcards).values(
      diff.toInsert.map((card) => ({
        id: card.id,
        userId,
        itemId,
        front: card.front,
        back: card.back,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }

  for (const card of diff.toUpdate) {
    await tx
      .update(flashcards)
      .set({ front: card.front, back: card.back, updatedAt: now })
      .where(and(eq(flashcards.id, card.id), eq(flashcards.userId, userId)));
  }

  if (diff.toDelete.length > 0) {
    await tx
      .delete(flashcards)
      .where(
        and(
          inArray(flashcards.id, diff.toDelete),
          eq(flashcards.userId, userId),
        ),
      );
  }

  return { normalizedNotes: changed ? normalized : null, diff };
};
