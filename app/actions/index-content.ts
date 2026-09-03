// Server-only implementations — see ./index.ts for the RPC layer.
//
// The index is built by a client worker (lib/index-worker/*) over the
// storage API in app/api/index/server.ts. These actions are the pieces the
// rest of the app needs directly: the agent's semantic search (the query
// vector arrives from the worker, which owns the model) and a manual
// re-index.
import { withCurrentUser } from "@/lib/db-helpers.server";
import { reopenContentJobs } from "@/lib/index/indexer.server";
import { safeAction } from "@/lib/safe-action";
import {
  parseInput,
  reindexItemSchema,
  semanticSearchSchema,
} from "@/lib/schemas";
import {
  type SemanticCardResult,
  type SemanticItemResult,
  semanticSearchCards,
  semanticSearchItems,
} from "@/lib/semantic-search.server";

export const semanticSearch = safeAction(async function semanticSearch(args: {
  model: string;
  vector: number[];
  scope: "items" | "cards";
  limit: number;
}): Promise<SemanticItemResult[] | SemanticCardResult[]> {
  const { model, vector, scope, limit } = parseInput(
    semanticSearchSchema,
    args,
  );
  return withCurrentUser<SemanticItemResult[] | SemanticCardResult[]>(
    (tx, userId) =>
      scope === "cards"
        ? semanticSearchCards(tx, userId, { model, vector }, limit)
        : semanticSearchItems(tx, userId, { model, vector }, limit),
    "semanticSearch",
  );
}, "Search failed. Please try again.");

export const reindexItem = safeAction(async function reindexItem(args: {
  itemId: string;
}): Promise<void> {
  const { itemId } = parseInput(reindexItemSchema, args);
  await withCurrentUser((tx, userId) =>
    reopenContentJobs(tx, userId, [itemId]),
  );
}, "Could not queue the item for indexing.");
