// The index's storage side. The client worker (lib/index-worker/*) does the
// fetching, extraction, and embedding; this module keeps item_content and
// chunks in step with the user's data and hands the worker its jobs.
//
// Everything here is a short transaction and idempotent, so any client can
// call it at any time: claiming takes a short lease so two open windows
// never extract the same url, and chunk sync compares hashes so unchanged
// notes and cards keep their embeddings.
import { createHash } from "node:crypto";

import { and, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";

import { type Tx } from "@/db";
import {
  type ChunkKind,
  chunks,
  flashcards,
  itemContent,
  items,
} from "@/db/schema";
import { findCardClose } from "@/lib/card-parse";

import { chunkContext, chunkEmbeddingText, chunkMarkdown } from "./chunk";

// Bump to re-extract every item with the worker's next pass.
const EXTRACTOR_VERSION = 1;
const MAX_ATTEMPTS = 3;
const RETRY_HOURS = [1, 6];
// Stored markdown is capped so one enormous PDF can't bloat the row.
const MAX_MARKDOWN_CHARS = 300_000;

const hashText = (text: string) =>
  createHash("sha256").update(text).digest("hex");

const nowIso = () => new Date().toISOString();

// Notes without their <card> blocks: the cards are indexed on their own, and
// leaving them in would double-count every card in the notes chunks.
const stripCardBlocks = (notes: string): string => {
  const lines = notes.split("\n");
  const kept: string[] = [];
  let fence = false;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();
    if (/^(`{3,}|~{3,})/.test(trimmed)) fence = !fence;
    if (!fence && /^<card\b[^>]*>$/i.test(trimmed)) {
      const close = findCardClose((i) => lines[i], index + 1, lines.length);
      if (close !== -1) {
        index = close;
        continue;
      }
    }
    kept.push(line);
  }
  return kept.join("\n").trim();
};

type NewChunk = {
  itemId: string | null;
  flashcardId: string | null;
  kind: ChunkKind;
  ordinal: number;
  heading: string | null;
  text: string;
};

const insertChunks = async (tx: Tx, userId: string, rows: NewChunk[]) => {
  if (rows.length === 0) return;
  const now = nowIso();
  await tx.insert(chunks).values(
    rows.map((row) => ({
      id: crypto.randomUUID(),
      userId,
      itemId: row.itemId,
      flashcardId: row.flashcardId,
      kind: row.kind,
      ordinal: row.ordinal,
      heading: row.heading,
      text: row.text,
      contentHash: hashText(chunkEmbeddingText(row)),
      createdAt: now,
      updatedAt: now,
    })),
  );
};

// One content row per linked item. A changed url reopens the job; a removed
// url drops the row and its content chunks.
const reconcileContentRows = async (tx: Tx, userId: string) => {
  await tx.execute(sql`
    INSERT INTO item_content (item_id, user_id, status, source_url, created_at, updated_at)
    SELECT i.id, i.user_id, 'pending', i.url, now(), now()
    FROM items i
    WHERE i.user_id = ${userId} AND i.url <> ''
      AND NOT EXISTS (SELECT 1 FROM item_content c WHERE c.item_id = i.id)
  `);
  await tx.execute(sql`
    UPDATE item_content c
    SET status = 'pending', source_url = i.url, attempts = 0,
        next_retry_at = NULL, claimed_until = NULL, error = NULL, updated_at = now()
    FROM items i
    WHERE i.id = c.item_id AND c.user_id = ${userId}
      AND i.url <> '' AND i.url <> c.source_url
  `);
  await tx.execute(sql`
    DELETE FROM chunks c USING items i
    WHERE i.id = c.item_id AND c.user_id = ${userId} AND c.kind = 'content' AND i.url = ''
  `);
  await tx.execute(sql`
    DELETE FROM item_content c USING items i
    WHERE i.id = c.item_id AND c.user_id = ${userId} AND i.url = ''
  `);
};

// Existing chunk hashes per owner, in ordinal order, joined into one string
// so a changed document compares as a single value.
const hashesByOwner = async (
  tx: Tx,
  userId: string,
  kind: ChunkKind,
  ownerColumn: typeof chunks.itemId | typeof chunks.flashcardId,
) => {
  const rows = await tx
    .select({ owner: ownerColumn, contentHash: chunks.contentHash })
    .from(chunks)
    .where(and(eq(chunks.userId, userId), eq(chunks.kind, kind)))
    .orderBy(ownerColumn, chunks.ordinal);
  const map = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.owner) continue;
    map.set(row.owner, [...(map.get(row.owner) ?? []), row.contentHash]);
  }
  return new Map([...map].map(([owner, hashes]) => [owner, hashes.join("|")]));
};

const syncNotesChunks = async (tx: Tx, userId: string) => {
  const rows = await tx
    .select({ id: items.id, title: items.title, notes: items.notes })
    .from(items)
    .where(eq(items.userId, userId));
  const existing = await hashesByOwner(tx, userId, "notes", chunks.itemId);
  for (const item of rows) {
    const text = stripCardBlocks(item.notes ?? "");
    const next: NewChunk[] = text
      ? chunkMarkdown(text).map((chunk) => ({
          itemId: item.id,
          flashcardId: null,
          kind: "notes",
          ordinal: chunk.ordinal,
          heading: chunkContext(item.title, chunk.heading),
          text: chunk.text,
        }))
      : [];
    const signature = next
      .map((row) => hashText(chunkEmbeddingText(row)))
      .join("|");
    if ((existing.get(item.id) ?? "") === signature) continue;
    await tx
      .delete(chunks)
      .where(
        and(
          eq(chunks.userId, userId),
          eq(chunks.itemId, item.id),
          eq(chunks.kind, "notes"),
        ),
      );
    await insertChunks(tx, userId, next);
  }
};

const syncCardChunks = async (tx: Tx, userId: string) => {
  const rows = await tx
    .select({
      id: flashcards.id,
      itemId: flashcards.itemId,
      front: flashcards.front,
      back: flashcards.back,
      itemTitle: items.title,
    })
    .from(flashcards)
    .leftJoin(
      items,
      and(eq(items.id, flashcards.itemId), eq(items.userId, userId)),
    )
    .where(eq(flashcards.userId, userId));
  const existing = await hashesByOwner(tx, userId, "card", chunks.flashcardId);
  const fresh: NewChunk[] = [];
  for (const card of rows) {
    const row: NewChunk = {
      itemId: card.itemId,
      flashcardId: card.id,
      kind: "card",
      ordinal: 0,
      heading: card.itemTitle ?? null,
      text: `${card.front}\n\n${card.back}`.trim(),
    };
    if (existing.get(card.id) === hashText(chunkEmbeddingText(row))) continue;
    await tx
      .delete(chunks)
      .where(and(eq(chunks.userId, userId), eq(chunks.flashcardId, card.id)));
    fresh.push(row);
  }
  await insertChunks(tx, userId, fresh);
};

// Bring the tables up to date with the items and cards: content rows for
// every linked item, notes and card chunks re-hashed. Cheap; runs at the
// start of every worker tick.
export const reconcileIndex = async (tx: Tx, userId: string) => {
  await reconcileContentRows(tx, userId);
  await syncNotesChunks(tx, userId);
  await syncCardChunks(tx, userId);
};

export type PendingChunk = { id: string; heading: string | null; text: string };

// Chunks the worker should embed: no vector yet, or one from another model.
// Cards and notes first: they are few, and they are the user's own words.
export const pendingChunks = async (
  tx: Tx,
  userId: string,
  model: string,
  limit: number,
): Promise<PendingChunk[]> =>
  tx
    .select({ id: chunks.id, heading: chunks.heading, text: chunks.text })
    .from(chunks)
    .where(
      and(
        eq(chunks.userId, userId),
        or(isNull(chunks.embedding), ne(chunks.model, model)),
      ),
    )
    .orderBy(
      sql`CASE ${chunks.kind} WHEN 'card' THEN 0 WHEN 'notes' THEN 1 ELSE 2 END`,
      chunks.createdAt,
      chunks.ordinal,
    )
    .limit(limit);

export const storeEmbeddings = async (
  tx: Tx,
  userId: string,
  model: string,
  vectors: { id: string; embedding: number[] }[],
) => {
  const now = nowIso();
  for (const { id, embedding } of vectors) {
    await tx
      .update(chunks)
      .set({ embedding, model, updatedAt: now })
      .where(and(eq(chunks.id, id), eq(chunks.userId, userId)));
  }
};

export type ContentJob = { itemId: string; url: string; attempts: number };

// Lease the next extraction jobs to the calling worker. Stale-version rows
// count as work too.
export const claimContentJobs = async (
  tx: Tx,
  userId: string,
  limit: number,
): Promise<ContentJob[]> => {
  const rows = await tx.execute(sql`
    UPDATE item_content
    SET claimed_until = now() + interval '3 minutes', updated_at = now()
    WHERE item_id IN (
      SELECT item_id FROM item_content
      WHERE user_id = ${userId}
        AND (status = 'pending' OR (status = 'ok' AND extractor_version < ${EXTRACTOR_VERSION}))
        AND (next_retry_at IS NULL OR next_retry_at < now())
        AND (claimed_until IS NULL OR claimed_until < now())
      ORDER BY created_at
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING item_id, source_url, attempts
  `);
  return (
    rows as unknown as {
      item_id: string;
      source_url: string;
      attempts: number;
    }[]
  ).map((row) => ({
    itemId: row.item_id,
    url: row.source_url,
    attempts: Number(row.attempts),
  }));
};

export type ExtractedContent = {
  itemId: string;
  extractor: string;
  title: string | null;
  markdown: string;
};

// Store what the worker extracted and re-chunk it (chunks keep their
// embeddings when the content hash is unchanged).
export const storeContent = async (
  tx: Tx,
  userId: string,
  extracted: ExtractedContent,
) => {
  const markdown = extracted.markdown.slice(0, MAX_MARKDOWN_CHARS);
  const contentHash = hashText(markdown);
  const [item] = await tx
    .select({ title: items.title })
    .from(items)
    .where(and(eq(items.id, extracted.itemId), eq(items.userId, userId)));
  if (!item) return;
  const [previous] = await tx
    .select({ contentHash: itemContent.contentHash })
    .from(itemContent)
    .where(eq(itemContent.itemId, extracted.itemId));
  const now = nowIso();
  await tx
    .update(itemContent)
    .set({
      status: "ok",
      extractor: extracted.extractor,
      extractorVersion: EXTRACTOR_VERSION,
      contentHash,
      title: extracted.title,
      markdown,
      wordCount: markdown.split(/\s+/).filter(Boolean).length,
      error: null,
      claimedUntil: null,
      nextRetryAt: null,
      fetchedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(itemContent.itemId, extracted.itemId),
        eq(itemContent.userId, userId),
      ),
    );
  if (previous?.contentHash === contentHash) return;
  await tx
    .delete(chunks)
    .where(
      and(
        eq(chunks.userId, userId),
        eq(chunks.itemId, extracted.itemId),
        eq(chunks.kind, "content"),
      ),
    );
  const title = extracted.title ?? item.title;
  await insertChunks(
    tx,
    userId,
    chunkMarkdown(markdown).map((chunk) => ({
      itemId: extracted.itemId,
      flashcardId: null,
      kind: "content",
      ordinal: chunk.ordinal,
      heading: chunkContext(title, chunk.heading),
      text: chunk.text,
    })),
  );
};

// Record a failed extraction: permanent ones (a 403, no readable content)
// are marked unsupported and never retried; the rest back off and retry,
// then fail for good after MAX_ATTEMPTS.
export const recordFailure = async (
  tx: Tx,
  userId: string,
  itemId: string,
  message: string,
  permanent: boolean,
) => {
  const [row] = await tx
    .select({ attempts: itemContent.attempts })
    .from(itemContent)
    .where(and(eq(itemContent.itemId, itemId), eq(itemContent.userId, userId)));
  if (!row) return;
  const attempts = row.attempts + 1;
  const status = permanent
    ? "unsupported"
    : attempts >= MAX_ATTEMPTS
      ? "failed"
      : "pending";
  const retryHours = RETRY_HOURS[attempts - 1] ?? null;
  const nextRetryAt =
    status === "pending" && retryHours !== null
      ? new Date(Date.now() + retryHours * 3_600_000).toISOString()
      : null;
  await tx
    .update(itemContent)
    .set({
      status,
      attempts,
      error: message.slice(0, 500),
      nextRetryAt,
      claimedUntil: null,
      updatedAt: nowIso(),
    })
    .where(and(eq(itemContent.itemId, itemId), eq(itemContent.userId, userId)));
};

// Reopen items' extraction (a manual retry, or a whole-deck re-index).
export const reopenContentJobs = async (
  tx: Tx,
  userId: string,
  itemIds: string[],
) => {
  if (itemIds.length === 0) return;
  await tx
    .update(itemContent)
    .set({
      status: "pending",
      attempts: 0,
      nextRetryAt: null,
      claimedUntil: null,
      error: null,
      extractorVersion: 0,
      updatedAt: nowIso(),
    })
    .where(
      and(inArray(itemContent.itemId, itemIds), eq(itemContent.userId, userId)),
    );
};
