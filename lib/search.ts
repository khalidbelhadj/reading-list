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

const fuzzySearch = async (
  tx: Tx,
  userId: string,
  pattern: string,
): Promise<SearchResult[]> => {
  const tokens = pattern
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `%${t}%`);

  if (tokens.length === 0) return [];

  const tokenConditions = tokens.map(
    (token) => sql`(
      i.title ILIKE ${token}
      OR i.url ILIKE ${token}
      OR COALESCE(i.notes, '') ILIKE ${token}
      OR COALESCE(fc_agg.fc_text, '') ILIKE ${token}
    )`,
  );

  const whereClause = tokenConditions.reduce((acc, cond) => sql`${acc} AND ${cond}`);

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
      (${tokens.map((t) => sql`(CASE WHEN i.title ILIKE ${t} THEN 1 ELSE 0 END)`).reduce((a, b) => sql`${a} + ${b}`)}) > 0 AS m_title,
      (${tokens.map((t) => sql`(CASE WHEN i.url ILIKE ${t} THEN 1 ELSE 0 END)`).reduce((a, b) => sql`${a} + ${b}`)}) > 0 AS m_url,
      (${tokens.map((t) => sql`(CASE WHEN COALESCE(i.notes, '') ILIKE ${t} THEN 1 ELSE 0 END)`).reduce((a, b) => sql`${a} + ${b}`)}) > 0 AS m_notes,
      (${tokens.map((t) => sql`(CASE WHEN COALESCE(fc_agg.fc_text, '') ILIKE ${t} THEN 1 ELSE 0 END)`).reduce((a, b) => sql`${a} + ${b}`)}) > 0 AS m_flashcards
    FROM items i
    LEFT JOIN fc_agg ON fc_agg.item_id = i.id
    WHERE i.user_id = ${userId}
      AND ${whereClause}
    ORDER BY i.position ASC
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
    .filter(Boolean)
    .map((t) => `%${t}%`);

  if (tokens.length === 0) return [];

  const tokenConditions = tokens.map(
    (token) => sql`(
      f.front ILIKE ${token}
      OR f.back ILIKE ${token}
      OR COALESCE(i.title, '') ILIKE ${token}
    )`,
  );

  const whereClause = tokenConditions.reduce((acc, cond) => sql`${acc} AND ${cond}`);

  const rows = await tx.execute(sql`
    SELECT
      f.id, f.item_id, f.front, f.back, f.state, f.due,
      i.title AS item_title,
      (${tokens.map((t) => sql`(CASE WHEN f.front ILIKE ${t} THEN 1 ELSE 0 END)`).reduce((a, b) => sql`${a} + ${b}`)}) > 0 AS m_front,
      (${tokens.map((t) => sql`(CASE WHEN f.back ILIKE ${t} THEN 1 ELSE 0 END)`).reduce((a, b) => sql`${a} + ${b}`)}) > 0 AS m_back,
      (${tokens.map((t) => sql`(CASE WHEN COALESCE(i.title, '') ILIKE ${t} THEN 1 ELSE 0 END)`).reduce((a, b) => sql`${a} + ${b}`)}) > 0 AS m_item_title
    FROM flashcards f
    LEFT JOIN items i ON i.id = f.item_id AND i.user_id = f.user_id
    WHERE f.user_id = ${userId}
      AND ${whereClause}
    ORDER BY f.created_at DESC
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
