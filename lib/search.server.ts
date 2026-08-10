import { sql } from "drizzle-orm";
import { z } from "zod";

import { type Tx } from "@/db";

const searchRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  notes: z.string().nullable(),
  starred: z.boolean(),
  read: z.boolean(),
  created_at: z.string(),
  m_title: z.boolean().nullable(),
  m_url: z.boolean().nullable(),
  m_notes: z.boolean().nullable(),
});
type SearchRow = z.infer<typeof searchRowSchema>;

const flashcardSearchRowSchema = z.object({
  id: z.string(),
  item_id: z.string().nullable(),
  front: z.string(),
  back: z.string(),
  state: z.string(),
  due: z.string(),
  item_title: z.string().nullable(),
  m_front: z.boolean().nullable(),
  m_back: z.boolean().nullable(),
  m_item_title: z.boolean().nullable(),
});
type FlashcardSearchRow = z.infer<typeof flashcardSearchRowSchema>;

const parseRows = <T>(schema: z.ZodType<T>, rows: unknown): T[] => {
  return z.array(schema).parse(rows);
};

type SearchMode = "fuzzy" | "regex";

export type SearchSort = "newest" | "oldest" | "title";

// Optional post-match filters / ordering, applied in SQL (so sort + limit are
// correct against the full match set, not a capped slice). Currently honored by
// regex search only — that's the path the MCP/Ask `search_items` tools use.
type SearchFilters = {
  tag?: string;
  read?: boolean;
  starred?: boolean;
  sort?: SearchSort;
  limit?: number;
};

export type SearchOptions = {
  caseSensitive?: boolean;
  mode?: SearchMode;
  filters?: SearchFilters;
};

export type SearchResult = {
  id: string;
  title: string;
  url: string;
  notes: string | null;
  starred: boolean;
  read: boolean;
  createdAt: string;
  // Card text now lives in `notes` (inline `<card>` blocks), so it's covered by
  // the "notes" match — there is no separate flashcards haystack here.
  matchedIn: ("title" | "url" | "notes")[];
};

const parseMode = (query: string): { mode: SearchMode; pattern: string } => {
  const regexMatch = query.match(/^\/(.+)\/$/);
  if (regexMatch && regexMatch[1] !== undefined) {
    return { mode: "regex", pattern: regexMatch[1] };
  }
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
    return regexSearch(tx, userId, pattern, caseSensitive, options?.filters);
  }
  return fuzzySearch(tx, userId, pattern);
};

const regexSearch = async (
  tx: Tx,
  userId: string,
  pattern: string,
  caseSensitive: boolean,
  filters?: SearchFilters,
): Promise<SearchResult[]> => {
  const op = sql.raw(caseSensitive ? "~" : "~*");

  // Optional filters folded into the match CTE so they run before ORDER/LIMIT.
  const readClause =
    filters?.read !== undefined ? sql` AND i.read = ${filters.read}` : sql``;
  const starredClause =
    filters?.starred !== undefined
      ? sql` AND i.starred = ${filters.starred}`
      : sql``;
  const tagClause = filters?.tag
    ? sql` AND EXISTS (
        SELECT 1 FROM items_tags it
        JOIN tags t ON t.id = it.tag_id
        WHERE it.item_id = i.id AND lower(t.name) = lower(${filters.tag})
      )`
    : sql``;

  const orderBy =
    filters?.sort === "oldest"
      ? sql`m.created_at ASC`
      : filters?.sort === "title"
        ? sql`m.title ASC`
        : sql`m.created_at DESC`;

  const limit = Math.max(1, Math.min(100, filters?.limit ?? 100));

  const rows = await tx.execute(sql`
    WITH matched AS (
      SELECT
        i.id, i.title, i.url, i.notes, i.starred, i.read, i.created_at,
        (i.title ${op} ${pattern})               AS m_title,
        (i.url   ${op} ${pattern})               AS m_url,
        (COALESCE(i.notes, '') ${op} ${pattern}) AS m_notes
      FROM items i
      WHERE i.user_id = ${userId}${readClause}${starredClause}${tagClause}
    )
    SELECT
      m.id, m.title, m.url, m.notes, m.starred, m.read,
      m.created_at,
      m.m_title, m.m_url, m.m_notes
    FROM matched m
    WHERE m.m_title OR m.m_url OR m.m_notes
    ORDER BY ${orderBy}
    LIMIT ${limit}
  `);

  return parseRows(searchRowSchema, rows).map(toResult);
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
    )`,
  );

  const whereClause = tokenConditions.reduce(
    (acc, cond) => sql`${acc} AND ${cond}`,
  );

  // Only run the full-pattern trigram match when the pattern is long enough
  // to produce a useful trigram set.
  const usePatternTrigram = pattern.length >= TRIGRAM_MIN_LENGTH;
  const fullLike = `%${pattern}%`;

  const rows = await tx.execute(sql`
    SELECT
      i.id, i.title, i.url, i.notes, i.starred, i.read,
      i.created_at,
      (${usePatternTrigram ? sql`i.title %> ${pattern}` : sql`i.title ILIKE ${fullLike}`}) AS m_title,
      (i.url ILIKE ${fullLike}) AS m_url,
      (${usePatternTrigram ? sql`COALESCE(i.notes, '') %> ${pattern}` : sql`COALESCE(i.notes, '') ILIKE ${fullLike}`}) AS m_notes,
      GREATEST(
        word_similarity(${pattern}, i.title) * 1.5,
        word_similarity(${pattern}, COALESCE(i.notes, ''))
      ) AS score
    FROM items i
    WHERE i.user_id = ${userId}
      AND ${whereClause}
    ORDER BY score DESC, i.created_at DESC
    LIMIT 100
  `);

  return parseRows(searchRowSchema, rows).map(toResult);
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

  return parseRows(flashcardSearchRowSchema, rows).map(toFlashcardResult);
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

  const whereClause = tokenConditions.reduce(
    (acc, cond) => sql`${acc} AND ${cond}`,
  );

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

  return parseRows(flashcardSearchRowSchema, rows).map(toFlashcardResult);
};

const toFlashcardResult = (r: FlashcardSearchRow): FlashcardSearchResult => {
  const matchedIn: FlashcardSearchResult["matchedIn"] = [];
  if (r.m_front) matchedIn.push("front");
  if (r.m_back) matchedIn.push("back");
  if (r.m_item_title) matchedIn.push("item_title");
  return {
    id: r.id,
    itemId: r.item_id,
    front: r.front,
    back: r.back,
    state: r.state,
    due: r.due,
    itemTitle: r.item_title,
    matchedIn,
  };
};

const toResult = (r: SearchRow): SearchResult => {
  const matchedIn: SearchResult["matchedIn"] = [];
  if (r.m_title) matchedIn.push("title");
  if (r.m_url) matchedIn.push("url");
  if (r.m_notes) matchedIn.push("notes");
  return {
    id: r.id,
    title: r.title,
    url: r.url,
    notes: r.notes,
    starred: r.starred,
    read: r.read,
    createdAt: r.created_at,
    matchedIn,
  };
};
