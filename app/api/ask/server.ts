import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
  convertToModelMessages,
  hasToolCall,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";

import { withUser } from "@/db";
import { getCurrentUserId } from "@/lib/auth";
import { searchFlashcards } from "@/lib/search.server";

import { searchMcpItems } from "../mcp/search";

// Pinned in one place so swapping the model (or provider) is a one-line change.
// flash-lite: fast/cheap with usable free-tier headroom — good for prototyping.
// gemini-3.5-flash gives richer answers but a tight 5 req/min free limit.
const MODEL = "gemini-3.1-flash-lite";

// Point the provider at GEMINI_API_KEY (the default provider looks for
// GOOGLE_GENERATIVE_AI_API_KEY).
const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT = `
You are the search agent for the user's personal reading list — saved articles, papers, videos, and PDFs, each with a title, url, optional notes, and flashcards. Your job is to find what they're asking for, whatever shape the ask takes.

Read the request for what it is. It might be a literal instruction ("anything whose title mentions X" — search exactly that, don't editorialize), a topic they care about ("I'm into distributed consensus" — cast a wide net: the topic, its synonyms, its neighboring concepts, the systems and people associated with it), a half-remembered item ("that talk about the exchange"), a filter ("unread rust posts", "my 5 newest papers"), or something else entirely. Match your strategy to the ask — don't force every request through the same funnel, and don't substitute your own judgment about what they *should* want for what they asked for.

Be persistent. If a search comes back thin, don't stop: widen the stem, try synonyms, try adjacent terms, try a different field or angle (a title word, a domain in the url, a phrase that would appear in notes). Several small searches that you union beat one perfect query. Only conclude nothing matches after you've genuinely tried a few directions.

Tool mechanics for search_items: it takes a raw POSIX regex \`pattern\` (NOT wrapped in slashes), matched case-insensitively against titles, urls, and notes. Build patterns from the SHORTEST distinguishing word STEM so every inflection and the bare root match: 'segment' catches segment/segments/segmentation/"Segment Anything", where 'segment(ing|ation)' misses the plain word. Use alternation for synonyms ('raft|paxos|consensus') and optional characters ('b-?tree'). The optional read / starred filters, sort (newest|oldest|title), and limit are there when the request implies them.

Your output is a live, append-only activity feed: before each tool call, write ONE short first-person sentence saying what you're trying (e.g. "Trying consensus-adjacent terms…"). Keep lines brief and factual — no opinions, no recommendations, no commentary on the items themselves.

Finish by calling present_results exactly once: a single plain sentence stating what was found, and the item ids ordered most relevant first. If nothing matched after real attempts, present an empty list and say briefly what you tried.
`;

export async function POST(request: Request) {
  // Cookie-session auth — same helper the server actions use. No MCP/OAuth round-trip;
  // the tools below run the existing search queries directly as this user.
  const userId = await getCurrentUserId();

  const { messages }: { messages: UIMessage[] } = await request.json();

  const tools = {
    search_items: tool({
      // Same tool as the MCP server's search_items (shared code path), so the
      // agent is exactly as powerful: case-insensitive POSIX regex over title,
      // url, and notes, returning full item fields + which fields hit.
      description:
        "PREFERRED tool for finding items by content. Use whenever the user asks for items matching a word, phrase, domain, or pattern. POSIX regex via Postgres `~`/`~*`, matched against title, url, and notes (inline flashcards live in notes, so card text is covered here too). Returns each item's id, title, url, notes, starred, read, createdAt, and a `matchedIn` array of which fields hit. Supports filtering by read/starred, sorting, and a result limit — all applied in the database. Case-insensitive by default. Capped at 100 results and a 10s server-side timeout.",
      inputSchema: z.object({
        pattern: z
          .string()
          .describe(
            "POSIX regular expression — a RAW pattern, not wrapped in slashes. Examples: 'rust', '^https://github\\.com/', '\\bsegment'. Use the shortest distinguishing stem so it matches every inflection (segment → segment/segments/segmentation/\"Segment Anything\"). Max 500 chars.",
          ),
        caseSensitive: z
          .boolean()
          .optional()
          .describe(
            "If true, use a case-sensitive match (`~` instead of `~*`).",
          ),
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
    search_flashcards: tool({
      description:
        "Search the user's flashcards by their front/back text or the title of the item they belong to. Returns cards with the id of their parent item.",
      inputSchema: z.object({
        query: z
          .string()
          .describe("Keywords (or /regex/) to match against flashcard text."),
      }),
      execute: async ({ query }) => {
        const results = await withUser(userId, (tx) =>
          searchFlashcards(tx, userId, query),
        );
        return results.slice(0, 30).map((r) => ({
          itemId: r.itemId,
          front: r.front,
          itemTitle: r.itemTitle,
        }));
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
      // Terminal tool — echo the agent's selection so the loop has a result and the
      // client can read the summary/itemIds straight off this part.
      execute: async (input) => input,
    }),
  };

  const result = streamText({
    model: google(MODEL),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools,
    // Run the tool-calling loop until the agent presents results (or we hit the
    // step ceiling as a guard against runaway loops).
    stopWhen: [stepCountIs(8), hasToolCall("present_results")],
  });

  return result.toUIMessageStreamResponse({
    // By default the SDK masks errors as "An error occurred." Surface the real
    // message to the server log and to the client so failures are debuggable.
    onError: (error) => {
      console.error("[/api/ask] stream error:", error);
      return error instanceof Error ? error.message : String(error);
    },
  });
}
