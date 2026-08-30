import { type Tx } from "@/db";
import {
  searchItems as searchItemsQuery,
  type SearchSort,
} from "@/lib/search.server";

import { type McpSearchItem, toMcpSearchItem } from "./types";

export type SearchItemsParams = {
  caseSensitive?: boolean;
  read?: boolean;
  starred?: boolean;
  sort?: SearchSort;
  limit?: number;
};

/**
 * Regex item search — the shared code path behind both the MCP `search_items`
 * tool and the in-app "Ask" agent, so the two stay identically powerful.
 * Always runs in regex mode (the `pattern` is a raw POSIX regex), with
 * optional read/starred filters, sort, and limit applied in SQL. Capped at
 * 100 results.
 *
 * Runs inside a caller-provided transaction so the caller owns `withUser`.
 */
export const searchMcpItems = async (
  tx: Tx,
  userId: string,
  pattern: string,
  params: SearchItemsParams = {},
): Promise<McpSearchItem[]> => {
  const { caseSensitive = false, read, starred, sort, limit } = params;
  const searchResults = await searchItemsQuery(tx, userId, pattern, {
    caseSensitive,
    mode: "regex",
    filters: { read, starred, sort, limit },
  });

  return searchResults.map((r) => toMcpSearchItem(r, r.matchedIn));
};
