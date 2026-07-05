import { eq, inArray } from "drizzle-orm";

import { type Tx } from "@/db";
import { itemsTags, tags } from "@/db/schema";
import { searchItems as searchItemsQuery, type SearchSort } from "@/lib/search";

import { toMcpSearchItem, type McpSearchItem } from "./types";

export type SearchItemsParams = {
  caseSensitive?: boolean;
  tag?: string;
  read?: boolean;
  starred?: boolean;
  sort?: SearchSort;
  limit?: number;
};

/**
 * Regex item search enriched with each item's tags — the shared code path
 * behind both the MCP `search_items` tool and the in-app "Ask" agent, so the
 * two stay identically powerful. Always runs in regex mode (the `pattern` is a
 * raw POSIX regex), with optional tag/read/starred filters, sort, and limit
 * applied in SQL. Capped at 100 results.
 *
 * Runs inside a caller-provided transaction so the caller owns `withUser`.
 */
export const searchItemsWithTags = async (
  tx: Tx,
  userId: string,
  pattern: string,
  params: SearchItemsParams = {},
): Promise<McpSearchItem[]> => {
  const { caseSensitive = false, tag, read, starred, sort, limit } = params;
  const searchResults = await searchItemsQuery(tx, userId, pattern, {
    caseSensitive,
    mode: "regex",
    filters: { tag, read, starred, sort, limit },
  });

  if (searchResults.length === 0) return [];

  const itemIds = searchResults.map((r) => r.id);
  const tagRows = await tx
    .select({ itemId: itemsTags.itemId, name: tags.name })
    .from(itemsTags)
    .innerJoin(tags, eq(tags.id, itemsTags.tagId))
    .where(inArray(itemsTags.itemId, itemIds));

  const tagsByItem = new Map<string, string[]>();
  for (const row of tagRows) {
    const existing = tagsByItem.get(row.itemId) ?? [];
    existing.push(row.name);
    tagsByItem.set(row.itemId, existing);
  }

  return searchResults.map((r) =>
    toMcpSearchItem(r, tagsByItem.get(r.id) ?? [], r.matchedIn),
  );
};
