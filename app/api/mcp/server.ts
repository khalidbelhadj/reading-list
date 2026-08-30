import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { and, desc, eq, sql } from "drizzle-orm";
import type { z } from "zod";

import { withUser } from "@/db";
import { flashcards, items } from "@/db/schema";
import { getCurrentUserIdFromRequest, UnauthorizedError } from "@/lib/auth";
import {
  createItems as createItemsLib,
  deleteItems as deleteItemsLib,
  updateItemWithCardSync,
} from "@/lib/items.server";
import { ActionError } from "@/lib/safe-action";
import {
  mcpCreateItemsSchema,
  mcpDeleteItemsSchema,
  mcpGetFlashcardsSchema,
  mcpGetItemSchema,
  mcpGetItemsSchema,
  mcpSearchFlashcardsSchema,
  mcpSearchItemsSchema,
  mcpUpdateItemsSchema,
  parseInput,
} from "@/lib/schemas";
import { searchFlashcards } from "@/lib/search.server";

import { searchMcpItems } from "./search";
import {
  type CreateItemsResponse,
  type DeleteItemsResponse,
  type GetFlashcardsResponse,
  type GetItemResponse,
  type GetItemsResponse,
  type SearchFlashcardsResponse,
  type SearchItemsResponse,
  toMcpFlashcard,
  toMcpItem,
  type UpdateItemsResponse,
} from "./types";

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

function text(content: string): ToolResult {
  return { content: [{ type: "text" as const, text: content }] };
}

function jsonText<T>(value: T): ToolResult {
  return text(JSON.stringify(value, null, 2));
}

// Maps known search-query failures (bad regex, statement timeout) to a
// user-facing message; returns null for anything else so callers rethrow.
function searchErrorText(error: unknown): string | null {
  const msg = error instanceof Error ? error.message : String(error);
  if (/invalid regular expression/i.test(msg)) {
    return `Invalid regex: ${msg}`;
  }
  if (/statement timeout|canceling statement/i.test(msg)) {
    return "Search timed out after 10s — pattern is too expensive. Try anchoring it (e.g. ^foo) or making it more specific.";
  }
  return null;
}

type JsonSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
};

// One entry per tool: MCP metadata + zod input schema + handler. ListTools
// and CallTool both derive from this table, so each tool name appears once.
type McpTool = {
  description: string;
  inputSchema: JsonSchema;
  handle: (args: unknown, userId: string) => Promise<ToolResult>;
};

// Binds a zod schema to its handler so `handle` receives parsed, typed args.
const defineTool = <S extends z.ZodTypeAny>(def: {
  description: string;
  inputSchema: JsonSchema;
  schema: S;
  handle: (args: z.output<S>, userId: string) => Promise<ToolResult>;
}): McpTool => ({
  description: def.description,
  inputSchema: def.inputSchema,
  handle: (args, userId) =>
    def.handle(parseInput(def.schema, args) as z.output<S>, userId),
});

const TOOLS: Record<string, McpTool> = {
  get_items: defineTool({
    description:
      "Browse items in creation order (newest first) — use this only when you need everything. DO NOT use get_items to find items by content; if the user is asking for items matching a word, phrase, regex, or domain (e.g. 'items about rust', 'YouTube links', 'anything mentioning auth'), use search_items instead. Paginating get_items to filter is wasteful and may miss matches in notes/flashcards. Supports limit and offset for pagination.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description:
            "Maximum number of items to return (1-100, capped at 100)",
        },
        offset: {
          type: "number",
          default: 0,
          description: "Number of items to skip (for pagination)",
        },
      },
    },
    schema: mcpGetItemsSchema,
    handle: async (parsed, userId) => {
      const offset = parsed.offset ?? 0;
      const [rows, [count]] = await withUser(userId, (tx) =>
        Promise.all([
          tx.query.items.findMany({
            where: eq(items.userId, userId),
            orderBy: [desc(items.createdAt)],
            offset,
            ...(parsed.limit !== undefined && { limit: parsed.limit }),
          }),
          tx
            .select({ total: sql<number>`count(*)::int` })
            .from(items)
            .where(eq(items.userId, userId)),
        ]),
      );
      return jsonText<GetItemsResponse>({
        items: rows.map(toMcpItem),
        total: count?.total ?? 0,
        offset,
        limit: parsed.limit ?? null,
      });
    },
  }),

  get_item: defineTool({
    description:
      "Look up a reading list item by its URL or ID. At least one of 'url' or 'id' must be provided.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL to look up" },
        id: { type: "string", description: "The item ID to look up" },
      },
    },
    schema: mcpGetItemSchema,
    handle: async (parsed, userId) => {
      const condition = parsed.id
        ? and(eq(items.id, parsed.id), eq(items.userId, userId))
        : and(eq(items.url, parsed.url!), eq(items.userId, userId));
      const [item] = await withUser(userId, (tx) =>
        tx.query.items.findMany({
          where: condition,
          limit: 1,
        }),
      );
      if (!item) return text("Not found");
      return jsonText<GetItemResponse>(toMcpItem(item));
    },
  }),

  search_items: defineTool({
    description:
      "PREFERRED tool for finding items by content. Use whenever the user asks for items matching a word, phrase, domain, or pattern — including 'items about X', 'links from Y', 'anything mentioning Z'. POSIX regex via Postgres `~`/`~*`, matched against title, url, and notes (inline flashcards live in notes, so card text is covered here too). Returns a `matchedIn` array per item indicating which fields hit. Case-insensitive by default. Capped at 100 results and a 10s server-side timeout. For pure browsing/pagination, use get_items.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description:
            "POSIX regular expression. Examples: 'rust', '^https://github\\.com/', '\\bauth(entication)?\\b'. Max 500 chars.",
        },
        caseSensitive: {
          type: "boolean",
          default: false,
          description:
            "If true, use case-sensitive match (`~` instead of `~*`).",
        },
      },
      required: ["pattern"],
    },
    schema: mcpSearchItemsSchema,
    handle: async (parsed, userId) => {
      const caseSensitive = parsed.caseSensitive ?? false;
      try {
        const results = await withUser(userId, (tx) =>
          searchMcpItems(tx, userId, parsed.pattern, { caseSensitive }),
        );

        return jsonText<SearchItemsResponse>({
          pattern: parsed.pattern,
          caseSensitive,
          total: results.length,
          truncated: results.length === 100,
          items: results,
        });
      } catch (e) {
        const message = searchErrorText(e);
        if (message) return text(message);
        throw e;
      }
    },
  }),

  create_items: defineTool({
    description:
      "Add one or more items to the reading list. Pass an array of items; the first item becomes the top of the list.",
    inputSchema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              url: { type: "string" },
              notes: { type: "string" },
            },
            required: ["title", "url"],
          },
        },
      },
      required: ["items"],
    },
    schema: mcpCreateItemsSchema,
    handle: async (parsed, userId) => {
      const ids = await withUser(userId, (tx) =>
        createItemsLib(tx, userId, parsed.items),
      );
      return jsonText<CreateItemsResponse>({ ids });
    },
  }),

  update_items: defineTool({
    description:
      "Update one or more items' fields. Pass an array of updates, each with an id.",
    inputSchema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "The item ID" },
              title: { type: "string" },
              url: { type: "string" },
              notes: { type: "string" },
              starred: { type: "boolean" },
              read: { type: "boolean" },
            },
            required: ["id"],
          },
        },
      },
      required: ["items"],
    },
    schema: mcpUpdateItemsSchema,
    handle: async (parsed, userId) => {
      const results: UpdateItemsResponse = await withUser(
        userId,
        async (tx) => {
          let updated = 0;
          const notFound: string[] = [];
          for (const update of parsed.items) {
            const { id, ...fields } = update;
            const found = await updateItemWithCardSync(tx, userId, id, fields);
            if (found) updated++;
            else notFound.push(id);
          }
          return { updated, notFound };
        },
      );
      return jsonText<UpdateItemsResponse>(results);
    },
  }),

  delete_items: defineTool({
    description: "Delete one or more items from the reading list.",
    inputSchema: {
      type: "object",
      properties: {
        ids: {
          type: "array",
          items: { type: "string" },
          description: "Item IDs to delete",
        },
      },
      required: ["ids"],
    },
    schema: mcpDeleteItemsSchema,
    handle: async (parsed, userId) => {
      const result = await withUser(userId, (tx) =>
        deleteItemsLib(tx, userId, parsed.ids),
      );
      return jsonText<DeleteItemsResponse>({
        deleted: result.deleted.length,
        notFound: result.notFound,
      });
    },
  }),

  get_flashcards: defineTool({
    description: "Get all flashcards for an item.",
    inputSchema: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "The item ID" },
      },
      required: ["itemId"],
    },
    schema: mcpGetFlashcardsSchema,
    handle: async (parsed, userId) => {
      const cards = await withUser(userId, (tx) =>
        tx
          .select({
            id: flashcards.id,
            itemId: flashcards.itemId,
            front: flashcards.front,
            back: flashcards.back,
            state: flashcards.state,
            due: flashcards.due,
          })
          .from(flashcards)
          .where(
            and(
              eq(flashcards.itemId, parsed.itemId),
              eq(flashcards.userId, userId),
            ),
          )
          .orderBy(desc(flashcards.createdAt)),
      );
      return jsonText<GetFlashcardsResponse>(cards.map(toMcpFlashcard));
    },
  }),

  search_flashcards: defineTool({
    description:
      "Search flashcards by front/back text and parent item title. Supports fuzzy search (space-separated tokens matched via ILIKE) by default. Wrap the pattern in slashes (`/pattern/`) to use POSIX regex (case-insensitive). Capped at 100 results with a 10s timeout.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Search query. Plain text for fuzzy search, or /regex/ for POSIX regex. Max 500 chars.",
        },
      },
      required: ["query"],
    },
    schema: mcpSearchFlashcardsSchema,
    handle: async (parsed, userId) => {
      const query = parsed.query;
      try {
        const results = await withUser(userId, (tx) =>
          searchFlashcards(tx, userId, query),
        );
        return jsonText<SearchFlashcardsResponse>({
          query,
          total: results.length,
          truncated: results.length === 100,
          flashcards: results,
        });
      } catch (e) {
        const message = searchErrorText(e);
        if (message) return text(message);
        throw e;
      }
    },
  }),
};

async function handleTool(
  name: string,
  args: unknown,
  userId: string,
): Promise<ToolResult> {
  const tool = TOOLS[name];
  if (!tool) {
    return {
      content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }
  try {
    return await tool.handle(args, userId);
  } catch (error) {
    // Surface deliberate, client-safe errors (input validation via parseInput,
    // auth) verbatim; genericize everything else so raw Postgres detail
    // (constraint names, SQL fragments) never reaches MCP clients — the way
    // safeAction does for server actions.
    if (error instanceof ActionError || error instanceof UnauthorizedError) {
      return {
        content: [{ type: "text" as const, text: error.message }],
        isError: true,
      };
    }
    console.error("[mcp:handleTool]", name, error);
    return {
      content: [
        {
          type: "text" as const,
          text: "Something went wrong. Please try again.",
        },
      ],
      isError: true,
    };
  }
}

function createServer(userId: string) {
  const server = new Server(
    { name: "reading-list", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: Object.entries(TOOLS).map(([name, tool]) => ({
      name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    return handleTool(
      request.params.name,
      request.params.arguments ?? {},
      userId,
    );
  });

  return server;
}

// Served by the /api/mcp server route (app/routes/api.mcp.ts) for GET, POST,
// and DELETE. Auth (Bearer or cookie) and CORS are handled by the global
// request middleware before this runs.
export async function handleMcpRequest(request: Request): Promise<Response> {
  const userId = await getCurrentUserIdFromRequest(request);
  const server = createServer(userId);
  const transport = new WebStandardStreamableHTTPServerTransport();
  await server.connect(transport);
  return transport.handleRequest(request);
}
