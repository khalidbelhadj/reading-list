// The agent's tools, shared by both /api/ask modes. Each one runs the
// existing search code as the signed-in user; none of them write.
import { tool } from "ai";
import { z } from "zod";

import { withUser } from "@/db";
import { itemContext } from "@/lib/index/item-context.server";
import { searchFlashcards } from "@/lib/search.server";

import { searchMcpItems } from "../mcp/search";

const buildAgentTools = (userId: string) => ({
  search_items: tool({
    // Same tool as the MCP server's search_items (shared code path), so the
    // agent is exactly as powerful: case-insensitive POSIX regex over title,
    // url, and notes, returning full item fields + which fields hit.
    description:
      "Regex search over items. POSIX regex via Postgres `~`/`~*`, matched against title, url, and notes (inline flashcards live in notes, so card text is covered here too). Returns each item's id, title, url, notes, starred, read, createdAt, and a `matchedIn` array of which fields hit. Supports filtering by read/starred, sorting, and a result limit. Case-insensitive by default. Capped at 100 results.",
    inputSchema: z.object({
      pattern: z
        .string()
        .describe(
          "POSIX regular expression — a RAW pattern, not wrapped in slashes. Examples: 'rust', '^https://github\\.com/', '\\bsegment'. Use the shortest distinguishing stem so it matches every inflection. Max 500 chars.",
        ),
      caseSensitive: z
        .boolean()
        .optional()
        .describe("If true, use a case-sensitive match (`~` instead of `~*`)."),
      read: z
        .boolean()
        .optional()
        .describe(
          "Filter by read state: true = read only, false = unread only.",
        ),
      starred: z
        .boolean()
        .optional()
        .describe(
          "Filter by starred/pinned: true = starred only, false = unstarred only.",
        ),
      sort: z
        .enum(["newest", "oldest", "title"])
        .optional()
        .describe(
          "Order results: 'newest' (default, by date added desc), 'oldest', or 'title' (A–Z).",
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Max items to return (1–100). Default 100."),
    }),
    execute: async ({ pattern, caseSensitive, read, starred, sort, limit }) =>
      withUser(userId, (tx) =>
        searchMcpItems(tx, userId, pattern, {
          caseSensitive,
          read,
          starred,
          sort,
          limit,
        }),
      ),
  }),
  // No execute: the embedding model lives in the client's index worker, so
  // the client runs this one (components/shell/use-ask.ts embeds the query,
  // calls the semanticSearch action, and sends the output back).
  semantic_search: tool({
    description:
      "Meaning-based search over the index: each item's extracted page content, the user's notes, and every flashcard. scope 'items' returns items ranked by their best-matching passage (id, title, url, score, matchedIn, snippet, flashcardCount); scope 'cards' returns individual flashcards (id, itemId, itemTitle, front, back, score). Phrase the query as a topic or a claim.",
    inputSchema: z.object({
      query: z
        .string()
        .min(1)
        .max(500)
        .describe("A topic, question, or claim in natural language."),
      scope: z
        .enum(["items", "cards"])
        .describe("'items' to rank sources, 'cards' to rank flashcards."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(40)
        .optional()
        .describe("Max results (1–40). Default 15."),
    }),
  }),
  search_flashcards: tool({
    description:
      "Keyword search over the user's flashcards by their front/back text or the title of the item they belong to. Returns each card's id, front, and its item's id and title.",
    inputSchema: z.object({
      query: z
        .string()
        .describe("Keywords (or /regex/) to match against flashcard text."),
    }),
    execute: async ({ query }) => {
      const results = await withUser(userId, (tx) =>
        searchFlashcards(tx, userId, query),
      );
      return results.slice(0, 40).map((r) => ({
        id: r.id,
        itemId: r.itemId,
        front: r.front,
        itemTitle: r.itemTitle,
      }));
    },
  }),
  read_item: tool({
    description:
      "Read one item: its title, url, notes, flashcards (with ids), and the start of its extracted content. Use it to judge a borderline candidate.",
    inputSchema: z.object({
      itemId: z.string().min(1),
    }),
    execute: async ({ itemId }) =>
      (await withUser(userId, (tx) => itemContext(tx, userId, itemId))) ?? {
        error: "Item not found",
      },
  }),
  present_results: tool({
    description:
      "Return the final answer: a one-line summary of what was found and the ids of the items to display, most relevant first. Call this exactly once, as the last step.",
    inputSchema: z.object({
      summary: z
        .string()
        .describe("One brief sentence describing the results for the user."),
      itemIds: z
        .array(z.string())
        .describe("Item ids to display, ordered most relevant first."),
    }),
    // Terminal tool — echo the agent's selection so the loop has a result and
    // the client can read the summary/itemIds straight off this part.
    execute: async (input) => input,
  }),
  present_review: tool({
    description:
      "Return the review stack: a short title, a one-sentence summary, the ids of items whose flashcards all belong, and the ids of individual flashcards to add from other items. Call this exactly once, as the last step.",
    inputSchema: z.object({
      title: z.string().describe("A few words naming the stack."),
      summary: z
        .string()
        .describe("One brief sentence on what the stack covers."),
      itemIds: z
        .array(z.string())
        .describe("Items to include wholesale (every flashcard of each)."),
      cardIds: z
        .array(z.string())
        .describe("Individual flashcard ids to add from other items."),
    }),
    execute: async (input) => input,
  }),
});

export type AgentMode = "search" | "review";

// The terminal tool each mode ends on; the other one is withheld so the
// agent can't finish the wrong way.
export const toolsForMode = (userId: string, mode: AgentMode) => {
  const { present_results, present_review, ...shared } =
    buildAgentTools(userId);
  return mode === "review"
    ? { ...shared, present_review }
    : { ...shared, present_results };
};
