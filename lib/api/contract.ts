import { z } from "zod";

import { settingsPatchSchema, settingsSchema } from "@/lib/settings";
import type { Item } from "@/lib/types";

// The HTTP API, defined once. Every client (the web shell, the Chrome
// extension, the Mac app, a phone one day) works from this table: the web
// through the typed client in lib/api/client.ts, the native apps through the
// OpenAPI document scripts/gen-openapi.ts derives from it. The server side
// is app/api/handlers.server.ts, dispatched by app/routes/api.$.ts.
//
// This module is client-safe: zod and types only.

export type Method = "GET" | "POST" | "PATCH" | "DELETE";

// A route's exact shape: `params` and `input` exist only when the route
// declares them, so call sites and handlers know statically which routes
// take arguments.
export type RouteDefinition<
  P extends z.ZodType | undefined,
  I extends z.ZodType | undefined,
  O extends z.ZodType,
> = {
  method: Method;
  /** Absolute path; `{name}` marks a path parameter. */
  path: string;
  summary: string;
  output: O;
} & ([P] extends [z.ZodType] ? { params: P } : { params?: undefined }) &
  ([I] extends [z.ZodType] ? { input: I } : { input?: undefined });

const route = <
  P extends z.ZodType | undefined = undefined,
  I extends z.ZodType | undefined = undefined,
  O extends z.ZodType = z.ZodType,
>(definition: {
  method: Method;
  path: string;
  summary: string;
  params?: P;
  input?: I;
  output: O;
}) => definition as RouteDefinition<P, I, O>;

// --- shared fields (lib/schemas.ts keeps the action-level ones) ---

const idSchema = z.string().min(1, "ID must not be empty");
const titleSchema = z.string().max(500, "Title must be under 500 characters");
const httpUrlSchema = z
  .string()
  .max(2048, "URL must be under 2048 characters")
  .refine((s) => /^https?:\/\//i.test(s), "URL must use http or https");
// Items can exist without a link: empty means none.
const optionalUrlSchema = z
  .string()
  .max(2048, "URL must be under 2048 characters")
  .refine(
    (s) => s === "" || /^https?:\/\//i.test(s),
    "URL must use http or https",
  );
const notesSchema = z
  .string()
  .max(100000, "Notes must be under 100,000 characters");
const flashcardTextSchema = z
  .string()
  .max(10000, "Flashcard text must be under 10,000 characters");
const idParams = z.object({ id: idSchema });
const okSchema = z.object({ ok: z.literal(true) });

// --- resources ---

export const itemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  url: z.string(),
  faviconUrl: z.string().nullable(),
  starred: z.boolean(),
  notes: z.string().nullable(),
  read: z.boolean(),
  readAt: z.string().nullable(),
  hiddenFromReview: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  flashcardCount: z.number().int(),
});

// The schema is the wire shape; lib/types.ts is the app's. Keep them
// assignable both ways so a drift fails the type check here.
const itemFromWire: Item = {} as z.infer<typeof itemSchema>;
const itemToWire: z.infer<typeof itemSchema> = {} as Item;
void itemFromWire;
void itemToWire;

export const flashcardSchema = z.object({
  id: z.string(),
  front: z.string(),
  back: z.string(),
  state: z.string(),
  due: z.string(),
  interval: z.number().int(),
  easeFactor: z.number(),
  reps: z.number().int(),
  lapses: z.number().int(),
  itemId: z.string().nullable(),
  itemTitle: z.string().nullable(),
  itemUrl: z.string().nullable(),
  itemFaviconUrl: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const searchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  notes: z.string().nullable(),
  starred: z.boolean(),
  read: z.boolean(),
  createdAt: z.string(),
  matchedIn: z.array(z.enum(["title", "url", "notes"])),
});

export const semanticItemResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  read: z.boolean(),
  starred: z.boolean(),
  flashcardCount: z.number().int(),
  score: z.number(),
  matchedIn: z.array(z.string()),
  snippet: z.string(),
});

export const semanticCardResultSchema = z.object({
  id: z.string(),
  itemId: z.string().nullable(),
  itemTitle: z.string().nullable(),
  front: z.string(),
  back: z.string(),
  score: z.number(),
});

export const versionInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
  environment: z.string(),
  buildTime: z.string().nullable(),
  commit: z.object({
    sha: z.string().nullable(),
    shortSha: z.string().nullable(),
    branch: z.string().nullable(),
    message: z.string().nullable(),
    url: z.string().nullable(),
  }),
  deployment: z.object({
    id: z.string().nullable(),
    region: z.string().nullable(),
    url: z.string().nullable(),
  }),
  runtime: z.object({ node: z.string() }),
});

export const createdItemSchema = z.object({
  ok: z.literal(true),
  itemId: z.string(),
  title: z.string(),
});
// The url is already saved: the existing item, so the client can offer it.
export const duplicateItemSchema = z.object({
  ok: z.literal(false),
  duplicate: z.object({
    id: z.string(),
    title: z.string(),
    url: z.string(),
    faviconUrl: z.string().nullable(),
  }),
});
export const createItemResultSchema = z.discriminatedUnion("ok", [
  createdItemSchema,
  duplicateItemSchema,
]);

export const updateItemFieldsSchema = z.object({
  title: titleSchema.optional(),
  url: optionalUrlSchema.optional(),
  faviconUrl: httpUrlSchema.optional(),
  starred: z.boolean().optional(),
  notes: notesSchema.optional(),
  read: z.boolean().optional(),
  hiddenFromReview: z.boolean().optional(),
  // With a new url, fetch the page's title too (while the item's own title is
  // still a placeholder, the caller decides).
  refreshTitle: z.boolean().optional(),
});

// --- the routes ---

export const contract = {
  listItems: route({
    method: "GET",
    path: "/api/items",
    summary:
      "Every item of the signed-in user, newest first, with its flashcard count.",
    output: z.array(itemSchema),
  }),
  createItem: route({
    method: "POST",
    path: "/api/items",
    summary:
      "Create an item. The id may be chosen by the client; without a title, one is fetched from the page.",
    input: z.object({
      id: idSchema.optional(),
      title: titleSchema.optional(),
      url: optionalUrlSchema.optional(),
      faviconUrl: httpUrlSchema.optional(),
      notes: notesSchema.optional(),
      allowDuplicateUrl: z.boolean().optional(),
    }),
    output: createItemResultSchema,
  }),
  searchItems: route({
    method: "POST",
    path: "/api/items/search",
    summary:
      "Search items by title, url and notes (regex when wrapped in slashes).",
    input: z.object({ query: z.string().max(500) }),
    output: z.array(searchResultSchema),
  }),
  listItemPreviews: route({
    method: "GET",
    path: "/api/items/previews",
    summary: "Preview images by item id (empty string: checked, none).",
    output: z.record(z.string(), z.string()),
  }),
  updateItem: route({
    method: "PATCH",
    path: "/api/items/{id}",
    summary:
      "Update an item's fields. Notes are reconciled into flashcards; urls are normalised.",
    params: idParams,
    input: updateItemFieldsSchema,
    output: z.object({ title: z.string().nullable() }),
  }),
  deleteItem: route({
    method: "DELETE",
    path: "/api/items/{id}",
    summary: "Delete an item and its flashcards.",
    params: idParams,
    output: okSchema,
  }),
  setItemRead: route({
    method: "POST",
    path: "/api/items/{id}/read",
    summary: "Mark an item read or unread.",
    params: idParams,
    input: z.object({ read: z.boolean() }),
    output: okSchema,
  }),
  generateItemPreview: route({
    method: "POST",
    path: "/api/items/{id}/preview",
    summary: "Render (or return) the item's first-page preview image.",
    params: idParams,
    output: z.object({ previewImageUrl: z.string().nullable() }),
  }),
  reindexItem: route({
    method: "POST",
    path: "/api/items/{id}/reindex",
    summary: "Queue the item for the search index again.",
    params: idParams,
    output: okSchema,
  }),
  fetchPageTitle: route({
    method: "POST",
    path: "/api/page-title",
    summary: "The title of a web page.",
    input: z.object({ url: httpUrlSchema }),
    output: z.object({ title: z.string().nullable() }),
  }),
  listFlashcards: route({
    method: "GET",
    path: "/api/flashcards",
    summary: "Every flashcard with its scheduling state and its item.",
    output: z.array(flashcardSchema),
  }),
  updateFlashcard: route({
    method: "PATCH",
    path: "/api/flashcards/{id}",
    summary:
      "Edit a flashcard's sides (also rewrites the card block in the notes).",
    params: idParams,
    input: z.object({
      front: flashcardTextSchema.optional(),
      back: flashcardTextSchema.optional(),
    }),
    output: okSchema,
  }),
  rateCard: route({
    method: "POST",
    path: "/api/flashcards/{id}/rate",
    summary: "Rate a card; reschedules it unless this is a cram pass.",
    params: idParams,
    input: z.object({
      rating: z.enum(["again", "hard", "good", "easy"]),
      affectsSchedule: z.boolean(),
    }),
    output: okSchema,
  }),
  semanticSearch: route({
    method: "POST",
    path: "/api/search/semantic",
    summary:
      "Nearest items or cards to a query vector (the client owns the model).",
    input: z.object({
      model: z.string().min(1).max(200),
      vector: z.array(z.number()).min(1).max(4096),
      scope: z.enum(["items", "cards"]),
      limit: z.number().int().min(1).max(40),
    }),
    output: z.union([
      z.array(semanticItemResultSchema),
      z.array(semanticCardResultSchema),
    ]),
  }),
  getSettings: route({
    method: "GET",
    path: "/api/settings",
    summary: "The user's settings.",
    output: settingsSchema,
  }),
  updateSettings: route({
    method: "PATCH",
    path: "/api/settings",
    summary: "Merge a settings patch.",
    input: settingsPatchSchema,
    output: okSchema,
  }),
  requestImageUpload: route({
    method: "POST",
    path: "/api/storage/uploads",
    summary:
      "A one-shot signed upload url for a note image, and the src to embed.",
    input: z.object({
      contentType: z.string(),
      size: z.number().int().positive(),
    }),
    output: z.object({ uploadUrl: z.string(), src: z.string() }),
  }),
  getVersion: route({
    method: "GET",
    path: "/api/version",
    summary: "Build and deployment info.",
    output: versionInfoSchema,
  }),
} as const;

type Contract = typeof contract;
export type RouteKey = keyof Contract;

export type Params<K extends RouteKey> = Contract[K] extends {
  params: infer P extends z.ZodType;
}
  ? z.infer<P>
  : undefined;
export type Input<K extends RouteKey> = Contract[K] extends {
  input: infer I extends z.ZodType;
}
  ? z.infer<I>
  : undefined;
export type Output<K extends RouteKey> = z.infer<Contract[K]["output"]>;

/** What a call needs: the path params and the body, when the route has them. */
export type RouteArgs<K extends RouteKey> = (Contract[K] extends {
  params: z.ZodType;
}
  ? { params: Params<K> }
  : Record<never, never>) &
  (Contract[K] extends { input: z.ZodType }
    ? { input: Input<K> }
    : Record<never, never>);

/** The path with its parameters filled in. */
export const fillPath = (path: string, params: Record<string, string> = {}) =>
  path.replace(/\{(\w+)\}/g, (_, name: string) =>
    encodeURIComponent(params[name] ?? ""),
  );
