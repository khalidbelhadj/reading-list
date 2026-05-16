import { sql } from "drizzle-orm";
import { type Tx } from "@/db";

export type SearchMode = "fuzzy" | "regex";

export type SearchOptions = {
  caseSensitive?: boolean;
  mode?: SearchMode;
};

export type SearchResult = {
  id: string;
  title: string;
  url: string;
  notes: string | null;
  starred: boolean;
  read: boolean;
  createdAt: string;
  matchedIn: ("title" | "url" | "notes" | "flashcards")[];
};

const parseMode = (query: string): { mode: SearchMode; pattern: string } => {
  const regexMatch = query.match(/^\/(.+)\/$/);
  if (regexMatch) return { mode: "regex", pattern: regexMatch[1] };
  return { mode: "fuzzy", pattern: query };
};

export const searchItems = async (
  tx: Tx,
  userId: string,
  rawQuery: string,
  options?: SearchOptions,
): Promise<SearchResult[]> => {
  const { caseSensitive = false, mode: modeOverride } = options ?? {};
  const { mode: detectedMode, pattern } = parseMode(rawQuery);
  const mode = modeOverride ?? detectedMode;

  if (pattern.length === 0) return [];
  if (pattern.length > 500) throw new Error("Pattern too long (max 500 chars)");

  await tx.execute(sql`SET LOCAL statement_timeout = '10000ms'`);
  await tx.execute(sql`SET LOCAL pg_trgm.word_similarity_threshold = 0.3`);

  if (mode === "regex") {
    return regexSearch(tx, userId, pattern, caseSensitive);
  }
  return fuzzySearch(tx, userId, pattern);
};

const regexSearch = async (
  tx: Tx,
  userId: string,
  pattern: string,
  caseSensitive: boolean,
): Promise<SearchResult[]> => {
  const op = sql.raw(caseSensitive ? "~" : "~*");

  const rows = await tx.execute(sql`
    WITH haystacks AS (
      SELECT
        i.id, i.title, i.url, i.notes, i.starred, i.read,
        i.created_at, i.position,
        COALESCE(
          STRING_AGG(f.front || E'\n' || f.back, E'\n'),
          ''
        ) AS fc_text
      FROM items i
      LEFT JOIN flashcards f
        ON f.item_id = i.id AND f.user_id = i.user_id
      WHERE i.user_id = ${userId}
      GROUP BY i.id
    ),
    matched AS (
      SELECT
        h.*,
        (h.title ${op} ${pattern})                  AS m_title,
        (h.url   ${op} ${pattern})                  AS m_url,
        (COALESCE(h.notes, '') ${op} ${pattern})    AS m_notes,
        (h.fc_text ${op} ${pattern})                AS m_flashcards
      FROM haystacks h
    )
    SELECT
      m.id, m.title, m.url, m.notes, m.starred, m.read,
      m.created_at,
      m.m_title, m.m_url, m.m_notes, m.m_flashcards
    FROM matched m
    WHERE m.m_title OR m.m_url OR m.m_notes OR m.m_flashcards
    ORDER BY m.position ASC
    LIMIT 100
  `);

  return (rows as unknown as Array<Record<string, unknown>>).map(toResult);
};

const TRIGRAM_MIN_LENGTH = 3;

const fuzzySearch = async (
  tx: Tx,
  userId: string,
  pattern: string,
): Promise<SearchResult[]> => {
  // Skip tokens shorter than 3 chars: the trigram GIN can't index them, and
  // ILIKE '%xx%' on those degrades to seq-scan with very low selectivity.
  const tokens = pattern
    .split(/\s+/)
    .filter((t) => t.length >= TRIGRAM_MIN_LENGTH);

  if (tokens.length === 0) return [];

  const tokenConditions = tokens.map(
    (token) => sql`(
      i.title %> ${token}
      OR i.url ILIKE ${`%${token}%`}
      OR COALESCE(i.notes, '') %> ${token}
      OR COALESCE(fc_agg.fc_text, '') %> ${token}
    )`,
  );

  const whereClause = tokenConditions.reduce((acc, cond) => sql`${acc} AND ${cond}`);

  // Only run the full-pattern trigram match when the pattern is long enough
  // to produce a useful trigram set.
  const usePatternTrigram = pattern.length >= TRIGRAM_MIN_LENGTH;
  const fullLike = `%${pattern}%`;

  const rows = await tx.execute(sql`
    WITH fc_agg AS (
      SELECT
        f.item_id,
        STRING_AGG(f.front || E'\n' || f.back, E'\n') AS fc_text
      FROM flashcards f
      WHERE f.user_id = ${userId}
      GROUP BY f.item_id
    )
    SELECT
      i.id, i.title, i.url, i.notes, i.starred, i.read,
      i.created_at, i.position,
      (${usePatternTrigram ? sql`i.title %> ${pattern}` : sql`i.title ILIKE ${fullLike}`}) AS m_title,
      (i.url ILIKE ${fullLike}) AS m_url,
      (${usePatternTrigram ? sql`COALESCE(i.notes, '') %> ${pattern}` : sql`COALESCE(i.notes, '') ILIKE ${fullLike}`}) AS m_notes,
      (${usePatternTrigram ? sql`COALESCE(fc_agg.fc_text, '') %> ${pattern}` : sql`COALESCE(fc_agg.fc_text, '') ILIKE ${fullLike}`}) AS m_flashcards,
      GREATEST(
        word_similarity(${pattern}, i.title) * 1.5,
        word_similarity(${pattern}, COALESCE(i.notes, '')),
        word_similarity(${pattern}, COALESCE(fc_agg.fc_text, ''))
      ) AS score
    FROM items i
    LEFT JOIN fc_agg ON fc_agg.item_id = i.id
    WHERE i.user_id = ${userId}
      AND ${whereClause}
    ORDER BY score DESC, i.position ASC
    LIMIT 100
  `);

  return (rows as unknown as Array<Record<string, unknown>>).map(toResult);
};

export type FlashcardSearchResult = {
  id: string;
  itemId: string | null;
  front: string;
  back: string;
  state: string;
  due: string;
  itemTitle: string | null;
  matchedIn: ("front" | "back" | "item_title")[];
};

export const searchFlashcards = async (
  tx: Tx,
  userId: string,
  rawQuery: string,
): Promise<FlashcardSearchResult[]> => {
  const { mode, pattern } = parseMode(rawQuery);

  if (pattern.length === 0) return [];
  if (pattern.length > 500) throw new Error("Pattern too long (max 500 chars)");

  await tx.execute(sql`SET LOCAL statement_timeout = '10000ms'`);
  await tx.execute(sql`SET LOCAL pg_trgm.word_similarity_threshold = 0.3`);

  if (mode === "regex") {
    return regexSearchFlashcards(tx, userId, pattern);
  }
  return fuzzySearchFlashcards(tx, userId, pattern);
};

const regexSearchFlashcards = async (
  tx: Tx,
  userId: string,
  pattern: string,
): Promise<FlashcardSearchResult[]> => {
  const op = sql.raw("~*");

  const rows = await tx.execute(sql`
    SELECT
      f.id, f.item_id, f.front, f.back, f.state, f.due,
      i.title AS item_title,
      (f.front ${op} ${pattern}) AS m_front,
      (f.back  ${op} ${pattern}) AS m_back,
      (COALESCE(i.title, '') ${op} ${pattern}) AS m_item_title
    FROM flashcards f
    LEFT JOIN items i ON i.id = f.item_id AND i.user_id = f.user_id
    WHERE f.user_id = ${userId}
      AND (
        f.front ${op} ${pattern}
        OR f.back ${op} ${pattern}
        OR COALESCE(i.title, '') ${op} ${pattern}
      )
    ORDER BY f.created_at DESC
    LIMIT 100
  `);

  return (rows as unknown as Array<Record<string, unknown>>).map(toFlashcardResult);
};

const fuzzySearchFlashcards = async (
  tx: Tx,
  userId: string,
  pattern: string,
): Promise<FlashcardSearchResult[]> => {
  const tokens = pattern
    .split(/\s+/)
    .filter((t) => t.length >= TRIGRAM_MIN_LENGTH);

  if (tokens.length === 0) return [];

  const tokenConditions = tokens.map(
    (token) => sql`(
      f.front %> ${token}
      OR f.back %> ${token}
      OR COALESCE(i.title, '') %> ${token}
    )`,
  );

  const whereClause = tokenConditions.reduce((acc, cond) => sql`${acc} AND ${cond}`);

  const usePatternTrigram = pattern.length >= TRIGRAM_MIN_LENGTH;
  const fullLike = `%${pattern}%`;

  const rows = await tx.execute(sql`
    SELECT
      f.id, f.item_id, f.front, f.back, f.state, f.due,
      i.title AS item_title,
      (${usePatternTrigram ? sql`f.front %> ${pattern}` : sql`f.front ILIKE ${fullLike}`}) AS m_front,
      (${usePatternTrigram ? sql`f.back %> ${pattern}` : sql`f.back ILIKE ${fullLike}`}) AS m_back,
      (${usePatternTrigram ? sql`COALESCE(i.title, '') %> ${pattern}` : sql`COALESCE(i.title, '') ILIKE ${fullLike}`}) AS m_item_title,
      GREATEST(
        word_similarity(${pattern}, f.front),
        word_similarity(${pattern}, f.back),
        word_similarity(${pattern}, COALESCE(i.title, ''))
      ) AS score
    FROM flashcards f
    LEFT JOIN items i ON i.id = f.item_id AND i.user_id = f.user_id
    WHERE f.user_id = ${userId}
      AND ${whereClause}
    ORDER BY score DESC, f.created_at DESC
    LIMIT 100
  `);

  return (rows as unknown as Array<Record<string, unknown>>).map(toFlashcardResult);
};

const toFlashcardResult = (r: Record<string, unknown>): FlashcardSearchResult => {
  const matchedIn: FlashcardSearchResult["matchedIn"] = [];
  if (r.m_front) matchedIn.push("front");
  if (r.m_back) matchedIn.push("back");
  if (r.m_item_title) matchedIn.push("item_title");
  return {
    id: r.id as string,
    itemId: r.item_id as string | null,
    front: r.front as string,
    back: r.back as string,
    state: r.state as string,
    due: r.due as string,
    itemTitle: r.item_title as string | null,
    matchedIn,
  };
};

const toResult = (r: Record<string, unknown>): SearchResult => {
  const matchedIn: SearchResult["matchedIn"] = [];
  if (r.m_title) matchedIn.push("title");
  if (r.m_url) matchedIn.push("url");
  if (r.m_notes) matchedIn.push("notes");
  if (r.m_flashcards) matchedIn.push("flashcards");
  return {
    id: r.id as string,
    title: r.title as string,
    url: r.url as string,
    notes: r.notes as string | null,
    starred: r.starred as boolean,
    read: r.read as boolean,
    createdAt: r.created_at as string,
    matchedIn,
  };
};
