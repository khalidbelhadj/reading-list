import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { similarity as trigramSimilarity } from "@/lib/trigram";
import { withUser } from "@/db";
import { items, tags, itemsTags, flashcards } from "@/db/schema";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getCurrentUserIdFromRequest } from "@/lib/auth";

const TOOLS = [
  {
    name: "get_items",
    description:
      "List reading list items. Optionally filter by type, tag, or search query. Supports sorting, limit, and offset for pagination.",
    inputSchema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          description: "Filter by item type (currently only \"reading-list\")",
        },
        tag: { type: "string", description: "Filter by tag name" },
        search: {
          type: "string",
          description: "Search query to match against title and URL",
        },
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
          description: "Maximum number of items to return",
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
    name: "get_item_by_url",
    description: "Look up a reading list item by its URL.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "The URL to look up" },
      },
      required: ["url"],
    },
  },
  {
    name: "create_item",
    description: "Add a new item to the reading list.",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: { type: "string" },
        url: { type: "string" },
        type: {
          type: "string",
          default: "reading-list",
        },
        tagNames: { type: "array", items: { type: "string" }, default: [] },
        notes: { type: "string" },
      },
      required: ["title", "url"],
    },
  },
  {
    name: "update_item",
    description: "Update an existing item's fields.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "The item ID" },
        title: { type: "string" },
        url: { type: "string" },
        notes: { type: "string" },
        tagNames: { type: "array", items: { type: "string" } },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_item",
    description: "Delete an item from the reading list.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "The item ID" },
      },
      required: ["id"],
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
    name: "create_flashcard",
    description: "Create a flashcard linked to an item.",
    inputSchema: {
      type: "object" as const,
      properties: {
        itemId: { type: "string", description: "The item ID" },
        front: { type: "string", description: "The question or prompt" },
        back: { type: "string", description: "The answer" },
      },
      required: ["itemId", "front", "back"],
    },
  },
  {
    name: "update_flashcard",
    description: "Update a flashcard's front or back text.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "The flashcard ID" },
        front: { type: "string" },
        back: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_flashcard",
    description: "Delete a flashcard.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "The flashcard ID" },
      },
      required: ["id"],
    },
  },
];

function text(content: string) {
  return { content: [{ type: "text" as const, text: content }] };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleTool(name: string, args: any, userId: string) {
  switch (name) {
    case "get_items": {
      const dir = args.order === "desc" ? desc : asc;
      const orderBy = {
        position: dir(items.position),
        created_at: dir(items.createdAt),
        updated_at: dir(items.updatedAt),
        title: dir(items.title),
      }[args.sort as string] ?? dir(items.position);

      const allItems = await withUser(userId, (tx) =>
        tx.query.items.findMany({
          where: eq(items.userId, userId),
          orderBy: [orderBy],
          with: { itemsTags: { with: { tag: true } } },
        }),
      );
      let result = allItems.map(({ itemsTags: it, ...item }) => ({
        ...item,
        tags: it.map((t) => t.tag.name),
      }));
      if (args.type) result = result.filter((i) => i.type === args.type);
      if (args.tag) result = result.filter((i) => i.tags.includes(args.tag));
      if (args.search) {
        const q = args.search.toLowerCase();
        const scored = result.map((i) => {
          const exact =
            i.title.toLowerCase().includes(q) ||
            i.url.toLowerCase().includes(q);
          return {
            item: i,
            score: exact ? 1 : trigramSimilarity(i.title.toLowerCase(), q),
          };
        });
        result = scored
          .filter((s) => s.score >= 0.15)
          .sort((a, b) => b.score - a.score)
          .map((s) => s.item);
      }
      const total = result.length;
      const offset = args.offset ?? 0;
      if (offset > 0) result = result.slice(offset);
      if (args.limit) result = result.slice(0, args.limit);
      return text(
        JSON.stringify(
          { items: result, total, offset, limit: args.limit ?? null },
          null,
          2,
        ),
      );
    }

    case "get_item_by_url": {
      const [item] = await withUser(userId, (tx) =>
        tx.query.items.findMany({
          where: and(eq(items.url, args.url), eq(items.userId, userId)),
          with: { itemsTags: { with: { tag: true } } },
          limit: 1,
        }),
      );
      if (!item) return text("Not found");
      const { itemsTags: it, ...rest } = item;
      return text(
        JSON.stringify({ ...rest, tags: it.map((t) => t.tag.name) }, null, 2),
      );
    }

    case "create_item": {
      const itemId = crypto.randomUUID();
      const now = new Date().toISOString();
      const type = args.type ?? "reading-list";
      const tagNames: string[] = args.tagNames ?? [];

      await withUser(userId, async (tx) => {
        await tx
          .update(items)
          .set({ position: sql`${items.position} + 1` })
          .where(and(eq(items.userId, userId), eq(items.type, type)));
        await tx.insert(items).values({
          id: itemId,
          userId,
          title: args.title,
          url: args.url,
          faviconUrl: null,
          type,
          starred: false,
          notes: args.notes ?? null,
          position: 0,
          createdAt: now,
          updatedAt: now,
        });
        for (const tagName of tagNames) {
          await tx
            .insert(tags)
            .values({ userId, name: tagName })
            .onConflictDoNothing();
          const [tag] = await tx
            .select()
            .from(tags)
            .where(and(eq(tags.userId, userId), eq(tags.name, tagName)));
          if (tag) await tx.insert(itemsTags).values({ itemId, tagId: tag.id });
        }
      });
      return text(JSON.stringify({ id: itemId }));
    }

    case "update_item": {
      const now = new Date().toISOString();
      const result = await withUser(userId, async (tx) => {
        const [owned] = await tx
          .select({ id: items.id })
          .from(items)
          .where(and(eq(items.id, args.id), eq(items.userId, userId)));
        if (!owned) return { ok: false };

        const set: Record<string, unknown> = { updatedAt: now };
        if (args.title !== undefined) set.title = args.title;
        if (args.url !== undefined) set.url = args.url;
        if (args.notes !== undefined) set.notes = args.notes;
        await tx
          .update(items)
          .set(set)
          .where(and(eq(items.id, args.id), eq(items.userId, userId)));

        if (args.tagNames !== undefined) {
          const existingLinks = await tx
            .select({ tagId: itemsTags.tagId })
            .from(itemsTags)
            .where(eq(itemsTags.itemId, args.id));
          const existingTagIds = existingLinks.map((l) => l.tagId);
          const newTagIds: number[] = [];
          for (const tagName of args.tagNames) {
            await tx
              .insert(tags)
              .values({ userId, name: tagName })
              .onConflictDoNothing();
            const [tag] = await tx
              .select()
              .from(tags)
              .where(and(eq(tags.userId, userId), eq(tags.name, tagName)));
            if (tag) newTagIds.push(tag.id);
          }
          for (const tagId of existingTagIds) {
            if (!newTagIds.includes(tagId)) {
              await tx
                .delete(itemsTags)
                .where(
                  and(
                    eq(itemsTags.itemId, args.id),
                    eq(itemsTags.tagId, tagId),
                  ),
                );
            }
          }
          for (const tagId of newTagIds) {
            if (!existingTagIds.includes(tagId)) {
              await tx.insert(itemsTags).values({ itemId: args.id, tagId });
            }
          }
        }
        return { ok: true };
      });
      if (!result.ok) return text("Not found");
      return text("Updated");
    }

    case "delete_item": {
      const deleted = await withUser(userId, async (tx) => {
        const [owned] = await tx
          .select({ id: items.id })
          .from(items)
          .where(and(eq(items.id, args.id), eq(items.userId, userId)));
        if (!owned) return false;
        await tx.delete(itemsTags).where(eq(itemsTags.itemId, args.id));
        await tx
          .delete(flashcards)
          .where(
            and(
              eq(flashcards.itemId, args.id),
              eq(flashcards.userId, userId),
            ),
          );
        await tx
          .delete(items)
          .where(and(eq(items.id, args.id), eq(items.userId, userId)));
        return true;
      });
      if (!deleted) return text("Not found");
      return text("Deleted");
    }

    case "get_flashcards": {
      const cards = await withUser(userId, (tx) =>
        tx
          .select()
          .from(flashcards)
          .where(
            and(
              eq(flashcards.itemId, args.itemId),
              eq(flashcards.userId, userId),
            ),
          )
          .orderBy(desc(flashcards.createdAt)),
      );
      return text(JSON.stringify(cards, null, 2));
    }

    case "create_flashcard": {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const result = await withUser(userId, async (tx) => {
        const [owned] = await tx
          .select({ id: items.id })
          .from(items)
          .where(and(eq(items.id, args.itemId), eq(items.userId, userId)));
        if (!owned) return { ok: false };
        await tx.insert(flashcards).values({
          id,
          userId,
          itemId: args.itemId,
          front: args.front,
          back: args.back,
          createdAt: now,
          updatedAt: now,
        });
        return { ok: true };
      });
      if (!result.ok) return text("Item not found");
      return text(JSON.stringify({ id }));
    }

    case "update_flashcard": {
      const now = new Date().toISOString();
      const set: Record<string, unknown> = { updatedAt: now };
      if (args.front !== undefined) set.front = args.front;
      if (args.back !== undefined) set.back = args.back;
      await withUser(userId, (tx) =>
        tx
          .update(flashcards)
          .set(set)
          .where(
            and(eq(flashcards.id, args.id), eq(flashcards.userId, userId)),
          ),
      );
      return text("Updated");
    }

    case "delete_flashcard": {
      await withUser(userId, (tx) =>
        tx
          .delete(flashcards)
          .where(
            and(eq(flashcards.id, args.id), eq(flashcards.userId, userId)),
          ),
      );
      return text("Deleted");
    }

    default:
      return {
        content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
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
