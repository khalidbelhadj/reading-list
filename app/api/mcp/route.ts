import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { withUser } from "@/db";
import { items, tags, itemsTags, flashcards } from "@/db/schema";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getCurrentUserIdFromRequest } from "@/lib/auth";
import { searchItems as searchItemsQuery, searchFlashcards } from "@/lib/search";
import {
  createItems as createItemsLib,
  updateItem as updateItemLib,
  deleteItems as deleteItemsLib,
} from "@/lib/items";
import {
  createFlashcards as createFlashcardsLib,
  updateFlashcards as updateFlashcardsLib,
  deleteFlashcards as deleteFlashcardsLib,
} from "@/lib/flashcards";
import {
  parseInput,
  mcpGetItemsSchema,
  mcpGetItemSchema,
  mcpSearchItemsSchema,
  mcpCreateItemsSchema,
  mcpUpdateItemsSchema,
  mcpDeleteItemsSchema,
  mcpGetFlashcardsSchema,
  mcpCreateFlashcardsSchema,
  mcpUpdateFlashcardsSchema,
  mcpDeleteFlashcardsSchema,
  mcpSearchFlashcardsSchema,
} from "@/lib/schemas";
import {
  toMcpItem,
  toMcpFlashcard,
  toMcpSearchItem,
  type GetItemsResponse,
  type GetItemResponse,
  type SearchItemsResponse,
  type CreateItemsResponse,
  type UpdateItemsResponse,
  type DeleteItemsResponse,
  type GetFlashcardsResponse,
  type CreateFlashcardsResponse,
  type UpdateFlashcardsResponse,
  type DeleteFlashcardsResponse,
  type SearchFlashcardsResponse,
} from "./types";

const TOOLS = [
  {
    name: "get_items",
    description:
      "Browse items in order — use this only when you need everything, or items filtered by tag. DO NOT use get_items to find items by content; if the user is asking for items matching a word, phrase, regex, or domain (e.g. 'items about rust', 'YouTube links', 'anything mentioning auth'), use search_items instead. Paginating get_items to filter is wasteful and may miss matches in notes/flashcards. Supports sort, limit, and offset for pagination.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tag: { type: "string", description: "Filter by tag name" },
        sort: {
          type: "string",
          enum: ["position", "created_at", "updated_at", "title"],
          default: "position",
          description: "Sort field",
        },
        order: {
          type: "string",
          enum: ["asc", "desc"],
          default: "asc",
          description: "Sort direction",
        },
        limit: {
          type: "number",
          description: "Maximum number of items to return (1-100, capped at 100)",
        },
        offset: {
          type: "number",
          default: 0,
          description: "Number of items to skip (for pagination)",
        },
      },
    },
  },
  {
    name: "get_item",
    description: "Look up a reading list item by its URL or ID. At least one of 'url' or 'id' must be provided.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "The URL to look up" },
        id: { type: "string", description: "The item ID to look up" },
      },
    },
  },
  {
    name: "search_items",
    description:
      "PREFERRED tool for finding items by content. Use whenever the user asks for items matching a word, phrase, domain, or pattern — including 'items about X', 'links from Y', 'anything mentioning Z'. POSIX regex via Postgres `~`/`~*`, matched against title, url, notes, and the concatenated front+back of each item's flashcards. Returns a `matchedIn` array per item indicating which fields hit. Case-insensitive by default. Capped at 100 results and a 10s server-side timeout. For pure browsing/pagination, use get_items.",
    inputSchema: {
      type: "object" as const,
      properties: {
        pattern: {
          type: "string",
          description:
            "POSIX regular expression. Examples: 'rust', '^https://github\\.com/', '\\bauth(entication)?\\b'. Max 500 chars.",
        },
        caseSensitive: {
          type: "boolean",
          default: false,
          description: "If true, use case-sensitive match (`~` instead of `~*`).",
        },
      },
      required: ["pattern"],
    },
  },
  {
    name: "create_items",
    description:
      "Add one or more items to the reading list. Pass an array of items; the first item becomes the top of the list.",
    inputSchema: {
      type: "object" as const,
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              url: { type: "string" },
              tagNames: {
                type: "array",
                items: { type: "string" },
                default: [],
              },
              notes: { type: "string" },
            },
            required: ["title", "url"],
          },
        },
      },
      required: ["items"],
    },
  },
  {
    name: "update_items",
    description:
      "Update one or more items' fields. Pass an array of updates, each with an id.",
    inputSchema: {
      type: "object" as const,
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
              tagNames: { type: "array", items: { type: "string" } },
            },
            required: ["id"],
          },
        },
      },
      required: ["items"],
    },
  },
  {
    name: "delete_items",
    description: "Delete one or more items from the reading list.",
    inputSchema: {
      type: "object" as const,
      properties: {
        ids: {
          type: "array",
          items: { type: "string" },
          description: "Item IDs to delete",
        },
      },
      required: ["ids"],
    },
  },
  {
    name: "get_flashcards",
    description: "Get all flashcards for an item.",
    inputSchema: {
      type: "object" as const,
      properties: {
        itemId: { type: "string", description: "The item ID" },
      },
      required: ["itemId"],
    },
  },
  {
    name: "create_flashcards",
    description: "Create one or more flashcards linked to items.",
    inputSchema: {
      type: "object" as const,
      properties: {
        flashcards: {
          type: "array",
          items: {
            type: "object",
            properties: {
              itemId: { type: "string", description: "The item ID" },
              front: { type: "string", description: "The question or prompt" },
              back: { type: "string", description: "The answer" },
            },
            required: ["itemId", "front", "back"],
          },
        },
      },
      required: ["flashcards"],
    },
  },
  {
    name: "update_flashcards",
    description: "Update one or more flashcards' front or back text.",
    inputSchema: {
      type: "object" as const,
      properties: {
        flashcards: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "The flashcard ID" },
              front: { type: "string" },
              back: { type: "string" },
            },
            required: ["id"],
          },
        },
      },
      required: ["flashcards"],
    },
  },
  {
    name: "delete_flashcards",
    description: "Delete one or more flashcards.",
    inputSchema: {
      type: "object" as const,
      properties: {
        ids: {
          type: "array",
          items: { type: "string" },
          description: "Flashcard IDs to delete",
        },
      },
      required: ["ids"],
    },
  },
  {
    name: "search_flashcards",
    description:
      "Search flashcards by front/back text and parent item title. Supports fuzzy search (space-separated tokens matched via ILIKE) by default. Wrap the pattern in slashes (`/pattern/`) to use POSIX regex (case-insensitive). Capped at 100 results with a 10s timeout.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Search query. Plain text for fuzzy search, or /regex/ for POSIX regex. Max 500 chars.",
        },
      },
      required: ["query"],
    },
  },
];

function text(content: string) {
  return { content: [{ type: "text" as const, text: content }] };
}

function jsonText<T>(value: T) {
  return text(JSON.stringify(value, null, 2));
}

async function handleTool(name: string, args: unknown, userId: string) {
  try {
  switch (name) {
    case "get_items": {
      const parsed = parseInput(mcpGetItemsSchema, args);
      const dir = parsed.order === "desc" ? desc : asc;
      const orderBy = {
        position: dir(items.position),
        created_at: dir(items.createdAt),
        updated_at: dir(items.updatedAt),
        title: dir(items.title),
      }[parsed.sort ?? "position"] ?? dir(items.position);

      const allItems = await withUser(userId, (tx) =>
        tx.query.items.findMany({
          where: eq(items.userId, userId),
          orderBy: [orderBy],
          with: { itemsTags: { with: { tag: true } } },
        }),
      );
      let result = allItems.map((item) =>
        toMcpItem(
          item,
          item.itemsTags.map((t) => t.tag.name),
        ),
      );
      if (parsed.tag) result = result.filter((i) => i.tags.includes(parsed.tag!));
      const total = result.length;
      const offset = parsed.offset ?? 0;
      if (offset > 0) result = result.slice(offset);
      if (parsed.limit) result = result.slice(0, parsed.limit);
      return jsonText<GetItemsResponse>({
        items: result,
        total,
        offset,
        limit: parsed.limit ?? null,
      });
    }

    case "get_item": {
      const parsed = parseInput(mcpGetItemSchema, args);
      const condition = parsed.id
        ? and(eq(items.id, parsed.id), eq(items.userId, userId))
        : and(eq(items.url, parsed.url!), eq(items.userId, userId));
      const [item] = await withUser(userId, (tx) =>
        tx.query.items.findMany({
          where: condition,
          with: { itemsTags: { with: { tag: true } } },
          limit: 1,
        }),
      );
      if (!item) return text("Not found");
      return jsonText<GetItemResponse>(
        toMcpItem(item, item.itemsTags.map((t) => t.tag.name)),
      );
    }

    case "search_items": {
      const parsed = parseInput(mcpSearchItemsSchema, args);
      const caseSensitive = parsed.caseSensitive ?? false;

      try {
        const results = await withUser(userId, async (tx) => {
          const searchResults = await searchItemsQuery(tx, userId, parsed.pattern, {
            caseSensitive,
            mode: "regex",
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
        });

        return jsonText<SearchItemsResponse>({
          pattern: parsed.pattern,
          caseSensitive,
          total: results.length,
          truncated: results.length === 100,
          items: results,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/invalid regular expression/i.test(msg)) {
          return text(`Invalid regex: ${msg}`);
        }
        if (/statement timeout|canceling statement/i.test(msg)) {
          return text(
            "Search timed out after 10s — pattern is too expensive. Try anchoring it (e.g. ^foo) or making it more specific.",
          );
        }
        throw e;
      }
    }

    case "create_items": {
      const parsed = parseInput(mcpCreateItemsSchema, args);
      const ids = await withUser(userId, (tx) =>
        createItemsLib(tx, userId, parsed.items),
      );
      return jsonText<CreateItemsResponse>({ ids });
    }

    case "update_items": {
      const parsed = parseInput(mcpUpdateItemsSchema, args);
      const results: UpdateItemsResponse = await withUser(userId, async (tx) => {
        let updated = 0;
        const notFound: string[] = [];
        for (const update of parsed.items) {
          const { id, ...fields } = update;
          const found = await updateItemLib(tx, userId, id, fields);
          if (found) updated++;
          else notFound.push(id);
        }
        return { updated, notFound };
      });
      return jsonText<UpdateItemsResponse>(results);
    }

    case "delete_items": {
      const parsed = parseInput(mcpDeleteItemsSchema, args);
      const result = await withUser(userId, (tx) =>
        deleteItemsLib(tx, userId, parsed.ids),
      );
      return jsonText<DeleteItemsResponse>({
        deleted: result.deleted.length,
        notFound: result.notFound,
      });
    }

    case "get_flashcards": {
      const parsed = parseInput(mcpGetFlashcardsSchema, args);
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
    }

    case "create_flashcards": {
      const parsed = parseInput(mcpCreateFlashcardsSchema, args);
      const result = await withUser(userId, (tx) =>
        createFlashcardsLib(tx, userId, parsed.flashcards),
      );
      return jsonText<CreateFlashcardsResponse>({
        ids: result.created.map((c) => c.id),
        notFound: result.notFound,
      });
    }

    case "update_flashcards": {
      const parsed = parseInput(mcpUpdateFlashcardsSchema, args);
      const result = await withUser(userId, (tx) =>
        updateFlashcardsLib(tx, userId, parsed.flashcards),
      );
      return jsonText<UpdateFlashcardsResponse>(result);
    }

    case "delete_flashcards": {
      const parsed = parseInput(mcpDeleteFlashcardsSchema, args);
      const result = await withUser(userId, (tx) =>
        deleteFlashcardsLib(tx, userId, parsed.ids),
      );
      return jsonText<DeleteFlashcardsResponse>(result);
    }

    case "search_flashcards": {
      const parsed = parseInput(mcpSearchFlashcardsSchema, args);
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
        const msg = e instanceof Error ? e.message : String(e);
        if (/invalid regular expression/i.test(msg)) {
          return text(`Invalid regex: ${msg}`);
        }
        if (/statement timeout|canceling statement/i.test(msg)) {
          return text(
            "Search timed out after 10s — query is too expensive. Try making it more specific.",
          );
        }
        throw e;
      }
    }

    default:
      return {
        content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
  } catch (error) {
    return {
      content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }],
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
    tools: TOOLS,
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

async function handleMcpRequest(request: Request): Promise<Response> {
  const userId = await getCurrentUserIdFromRequest(request);
  const server = createServer(userId);
  const transport = new WebStandardStreamableHTTPServerTransport();
  await server.connect(transport);
  return transport.handleRequest(request);
}

export async function GET(request: Request) {
  return handleMcpRequest(request);
}

export async function POST(request: Request) {
  return handleMcpRequest(request);
}

export async function DELETE(request: Request) {
  return handleMcpRequest(request);
}
