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
import { pruneOrphanTags } from "@/lib/tags";

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
              type: { type: "string", default: "reading-list" },
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

    case "create_items": {
      const inputs: Array<{
        title: string;
        url: string;
        type?: string;
        tagNames?: string[];
        notes?: string;
      }> = args.items ?? [];
      const now = new Date().toISOString();
      const created: Array<{ id: string; type: string }> = inputs.map((i) => ({
        id: crypto.randomUUID(),
        type: i.type ?? "reading-list",
      }));

      await withUser(userId, async (tx) => {
        const shiftByType = new Map<string, number>();
        for (const c of created) {
          shiftByType.set(c.type, (shiftByType.get(c.type) ?? 0) + 1);
        }
        for (const [type, count] of shiftByType) {
          await tx
            .update(items)
            .set({ position: sql`${items.position} + ${count}` })
            .where(and(eq(items.userId, userId), eq(items.type, type)));
        }

        const positionByType = new Map<string, number>();
        for (let idx = 0; idx < inputs.length; idx++) {
          const input = inputs[idx];
          const { id: itemId, type } = created[idx];
          const position = positionByType.get(type) ?? 0;
          positionByType.set(type, position + 1);
          await tx.insert(items).values({
            id: itemId,
            userId,
            title: input.title,
            url: input.url,
            faviconUrl: null,
            type,
            starred: false,
            notes: input.notes ?? null,
            position,
            createdAt: now,
            updatedAt: now,
          });
          for (const tagName of input.tagNames ?? []) {
            await tx
              .insert(tags)
              .values({ userId, name: tagName })
              .onConflictDoNothing();
            const [tag] = await tx
              .select()
              .from(tags)
              .where(and(eq(tags.userId, userId), eq(tags.name, tagName)));
            if (tag)
              await tx.insert(itemsTags).values({ itemId, tagId: tag.id });
          }
        }
      });
      return text(JSON.stringify({ ids: created.map((c) => c.id) }));
    }

    case "update_items": {
      const updates: Array<{
        id: string;
        title?: string;
        url?: string;
        notes?: string;
        tagNames?: string[];
      }> = args.items ?? [];
      const now = new Date().toISOString();
      const results = await withUser(userId, async (tx) => {
        let updated = 0;
        const notFound: string[] = [];
        for (const update of updates) {
          const [owned] = await tx
            .select({ id: items.id })
            .from(items)
            .where(and(eq(items.id, update.id), eq(items.userId, userId)));
          if (!owned) {
            notFound.push(update.id);
            continue;
          }

          const set: Record<string, unknown> = { updatedAt: now };
          if (update.title !== undefined) set.title = update.title;
          if (update.url !== undefined) set.url = update.url;
          if (update.notes !== undefined) set.notes = update.notes;
          await tx
            .update(items)
            .set(set)
            .where(and(eq(items.id, update.id), eq(items.userId, userId)));

          if (update.tagNames !== undefined) {
            const existingLinks = await tx
              .select({ tagId: itemsTags.tagId })
              .from(itemsTags)
              .where(eq(itemsTags.itemId, update.id));
            const existingTagIds = existingLinks.map((l) => l.tagId);
            const newTagIds: number[] = [];
            for (const tagName of update.tagNames) {
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
            const removedTagIds: number[] = [];
            for (const tagId of existingTagIds) {
              if (!newTagIds.includes(tagId)) {
                await tx
                  .delete(itemsTags)
                  .where(
                    and(
                      eq(itemsTags.itemId, update.id),
                      eq(itemsTags.tagId, tagId),
                    ),
                  );
                removedTagIds.push(tagId);
              }
            }
            for (const tagId of newTagIds) {
              if (!existingTagIds.includes(tagId)) {
                await tx
                  .insert(itemsTags)
                  .values({ itemId: update.id, tagId });
              }
            }
            await pruneOrphanTags(tx, userId, removedTagIds);
          }
          updated++;
        }
        return { updated, notFound };
      });
      return text(JSON.stringify(results));
    }

    case "delete_items": {
      const ids: string[] = args.ids ?? [];
      const results = await withUser(userId, async (tx) => {
        let deleted = 0;
        const notFound: string[] = [];
        for (const id of ids) {
          const [owned] = await tx
            .select({ id: items.id })
            .from(items)
            .where(and(eq(items.id, id), eq(items.userId, userId)));
          if (!owned) {
            notFound.push(id);
            continue;
          }
          const affectedTagIds = (
            await tx
              .select({ tagId: itemsTags.tagId })
              .from(itemsTags)
              .where(eq(itemsTags.itemId, id))
          ).map((r) => r.tagId);
          await tx.delete(itemsTags).where(eq(itemsTags.itemId, id));
          await tx
            .delete(flashcards)
            .where(
              and(eq(flashcards.itemId, id), eq(flashcards.userId, userId)),
            );
          await tx
            .delete(items)
            .where(and(eq(items.id, id), eq(items.userId, userId)));
          await pruneOrphanTags(tx, userId, affectedTagIds);
          deleted++;
        }
        return { deleted, notFound };
      });
      return text(JSON.stringify(results));
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

    case "create_flashcards": {
      const inputs: Array<{ itemId: string; front: string; back: string }> =
        args.flashcards ?? [];
      const now = new Date().toISOString();
      const results = await withUser(userId, async (tx) => {
        const created: string[] = [];
        const notFound: string[] = [];
        for (const input of inputs) {
          const [owned] = await tx
            .select({ id: items.id })
            .from(items)
            .where(and(eq(items.id, input.itemId), eq(items.userId, userId)));
          if (!owned) {
            notFound.push(input.itemId);
            continue;
          }
          const id = crypto.randomUUID();
          await tx.insert(flashcards).values({
            id,
            userId,
            itemId: input.itemId,
            front: input.front,
            back: input.back,
            createdAt: now,
            updatedAt: now,
          });
          created.push(id);
        }
        return { ids: created, notFound };
      });
      return text(JSON.stringify(results));
    }

    case "update_flashcards": {
      const updates: Array<{ id: string; front?: string; back?: string }> =
        args.flashcards ?? [];
      const now = new Date().toISOString();
      const updated = await withUser(userId, async (tx) => {
        let count = 0;
        for (const update of updates) {
          const set: Record<string, unknown> = { updatedAt: now };
          if (update.front !== undefined) set.front = update.front;
          if (update.back !== undefined) set.back = update.back;
          await tx
            .update(flashcards)
            .set(set)
            .where(
              and(
                eq(flashcards.id, update.id),
                eq(flashcards.userId, userId),
              ),
            );
          count++;
        }
        return count;
      });
      return text(JSON.stringify({ updated }));
    }

    case "delete_flashcards": {
      const ids: string[] = args.ids ?? [];
      const deleted = await withUser(userId, async (tx) => {
        let count = 0;
        for (const id of ids) {
          await tx
            .delete(flashcards)
            .where(
              and(eq(flashcards.id, id), eq(flashcards.userId, userId)),
            );
          count++;
        }
        return count;
      });
      return text(JSON.stringify({ deleted }));
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
