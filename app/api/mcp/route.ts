import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { similarity as trigramSimilarity } from "@/lib/trigram";
import { db } from "@/db";
import { items, tags, itemsTags, flashcards } from "@/db/schema";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

const TOOLS = [
  {
    name: "get_items",
    description: "List reading list items. Optionally filter by type, tag, or search query (matches title and URL).",
    inputSchema: {
      type: "object" as const,
      properties: {
        type: { type: "string", enum: ["reading-list", "bookmark"], description: "Filter by item type" },
        tag: { type: "string", description: "Filter by tag name" },
        search: { type: "string", description: "Search query to match against title and URL" },
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
    description: "Add a new item to the reading list or bookmarks.",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: { type: "string" },
        url: { type: "string" },
        type: { type: "string", enum: ["reading-list", "bookmark"], default: "reading-list" },
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
async function handleTool(name: string, args: any) {
  switch (name) {
    case "get_items": {
      const allItems = await db.query.items.findMany({
        orderBy: [asc(items.position)],
        with: { itemsTags: { with: { tag: true } } },
      });
      let result = allItems.map(({ itemsTags: it, ...item }) => ({
        ...item,
        tags: it.map((t) => t.tag.name),
      }));
      if (args.type) result = result.filter((i) => i.type === args.type);
      if (args.tag) result = result.filter((i) => i.tags.includes(args.tag));
      if (args.search) {
        const q = args.search.toLowerCase();
        const scored = result.map((i) => {
          const exact = i.title.toLowerCase().includes(q) || i.url.toLowerCase().includes(q);
          return { item: i, score: exact ? 1 : trigramSimilarity(i.title.toLowerCase(), q) };
        });
        result = scored
          .filter((s) => s.score >= 0.15)
          .sort((a, b) => b.score - a.score)
          .map((s) => s.item);
      }
      return text(JSON.stringify(result, null, 2));
    }

    case "get_item_by_url": {
      const [item] = await db.query.items.findMany({
        where: eq(items.url, args.url),
        with: { itemsTags: { with: { tag: true } } },
        limit: 1,
      });
      if (!item) return text("Not found");
      const { itemsTags: it, ...rest } = item;
      return text(JSON.stringify({ ...rest, tags: it.map((t) => t.tag.name) }, null, 2));
    }

    case "create_item": {
      const itemId = crypto.randomUUID();
      const now = new Date().toISOString();
      const type = args.type ?? "reading-list";
      const tagNames: string[] = args.tagNames ?? [];

      await db.transaction(async (tx) => {
        await tx.update(items).set({ position: sql`${items.position} + 1` }).where(eq(items.type, type));
        await tx.insert(items).values({
          id: itemId, title: args.title, url: args.url, faviconUrl: null,
          type, starred: false, notes: args.notes ?? null, position: 0,
          createdAt: now, updatedAt: now,
        });
        for (const tagName of tagNames) {
          await tx.insert(tags).values({ name: tagName }).onConflictDoNothing();
          const [tag] = await tx.select().from(tags).where(eq(tags.name, tagName));
          if (tag) await tx.insert(itemsTags).values({ itemId, tagId: tag.id });
        }
      });
      revalidatePath("/");
      return text(JSON.stringify({ id: itemId }));
    }

    case "update_item": {
      const now = new Date().toISOString();
      await db.transaction(async (tx) => {
        const set: Record<string, unknown> = { updatedAt: now };
        if (args.title !== undefined) set.title = args.title;
        if (args.url !== undefined) set.url = args.url;
        if (args.notes !== undefined) set.notes = args.notes;
        await tx.update(items).set(set).where(eq(items.id, args.id));

        if (args.tagNames !== undefined) {
          const existingLinks = await tx.select({ tagId: itemsTags.tagId }).from(itemsTags).where(eq(itemsTags.itemId, args.id));
          const existingTagIds = existingLinks.map((l) => l.tagId);
          const newTagIds: number[] = [];
          for (const tagName of args.tagNames) {
            await tx.insert(tags).values({ name: tagName }).onConflictDoNothing();
            const [tag] = await tx.select().from(tags).where(eq(tags.name, tagName));
            if (tag) newTagIds.push(tag.id);
          }
          for (const tagId of existingTagIds) {
            if (!newTagIds.includes(tagId)) {
              await tx.delete(itemsTags).where(and(eq(itemsTags.itemId, args.id), eq(itemsTags.tagId, tagId)));
            }
          }
          for (const tagId of newTagIds) {
            if (!existingTagIds.includes(tagId)) {
              await tx.insert(itemsTags).values({ itemId: args.id, tagId });
            }
          }
        }
      });
      revalidatePath("/");
      return text("Updated");
    }

    case "delete_item": {
      await db.delete(itemsTags).where(eq(itemsTags.itemId, args.id));
      await db.delete(flashcards).where(eq(flashcards.itemId, args.id));
      await db.delete(items).where(eq(items.id, args.id));
      revalidatePath("/");
      return text("Deleted");
    }

    case "get_flashcards": {
      const cards = await db.select().from(flashcards)
        .where(eq(flashcards.itemId, args.itemId))
        .orderBy(desc(flashcards.createdAt));
      return text(JSON.stringify(cards, null, 2));
    }

    case "create_flashcard": {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await db.insert(flashcards).values({
        id, itemId: args.itemId, front: args.front, back: args.back,
        createdAt: now, updatedAt: now,
      });
      return text(JSON.stringify({ id }));
    }

    case "update_flashcard": {
      const now = new Date().toISOString();
      const set: Record<string, unknown> = { updatedAt: now };
      if (args.front !== undefined) set.front = args.front;
      if (args.back !== undefined) set.back = args.back;
      await db.update(flashcards).set(set).where(eq(flashcards.id, args.id));
      return text("Updated");
    }

    case "delete_flashcard": {
      await db.delete(flashcards).where(eq(flashcards.id, args.id));
      return text("Deleted");
    }

    default:
      return { content: [{ type: "text" as const, text: `Unknown tool: ${name}` }], isError: true };
  }
}

function createServer() {
  const server = new Server(
    { name: "reading-list", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    return handleTool(request.params.name, request.params.arguments ?? {});
  });

  return server;
}

async function handleMcpRequest(request: Request): Promise<Response> {
  const server = createServer();
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
