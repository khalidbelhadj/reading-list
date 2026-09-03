import { z } from "zod";

import { ActionError } from "@/lib/safe-action";

export const parseInput = <T>(schema: z.ZodSchema<T>, data: unknown): T => {
  const result = schema.safeParse(data);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    throw new ActionError(firstIssue?.message ?? "Invalid input");
  }
  return result.data;
};

// Shared field schemas
const idSchema = z.string().min(1, "ID must not be empty");
const titleSchema = z.string().max(500, "Title must be under 500 characters");
const urlSchema = z
  .string()
  .max(2048, "URL must be under 2048 characters")
  .refine((s) => /^https?:\/\//i.test(s), "URL must use http or https");
// Web-form variant: empty string is allowed (items can exist without a URL).
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

// Server action schemas
export const deleteItemSchema = z.object({
  itemId: idSchema,
});

export const fetchPageTitleSchema = z.object({
  url: urlSchema,
});

export const createItemSchema = z.object({
  title: titleSchema,
  url: optionalUrlSchema,
  faviconUrl: urlSchema.optional(),
  notes: notesSchema.optional(),
  id: idSchema.optional(),
});

export const updateItemSchema = z.object({
  itemId: idSchema,
  fields: z.object({
    title: titleSchema.optional(),
    url: optionalUrlSchema.optional(),
    faviconUrl: urlSchema.optional(),
    starred: z.boolean().optional(),
    notes: notesSchema.optional(),
    read: z.boolean().optional(),
    hiddenFromReview: z.boolean().optional(),
  }),
});

export const setItemReadSchema = z.object({
  itemId: idSchema,
  read: z.boolean(),
});

export const updateFlashcardSchema = z.object({
  id: idSchema,
  fields: z.object({
    front: flashcardTextSchema.optional(),
    back: flashcardTextSchema.optional(),
  }),
});

export const rateCardSchema = z.object({
  flashcardId: idSchema,
  rating: z.enum(["again", "hard", "good", "easy"], {
    message: "Rating must be 1-4 (again, hard, good, easy)",
  }),
  affectsSchedule: z.boolean(),
});

export const reindexItemSchema = z.object({
  itemId: idSchema,
});

export const semanticSearchSchema = z.object({
  model: z.string().min(1).max(200),
  vector: z.array(z.number()).min(1).max(4096),
  scope: z.enum(["items", "cards"]),
  limit: z.number().int().min(1).max(40),
});

// MCP tool schemas
export const mcpGetItemsSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});

export const mcpGetItemSchema = z
  .object({
    url: urlSchema.optional(),
    id: idSchema.optional(),
  })
  .refine((data) => data.url || data.id, {
    message: "At least one of 'url' or 'id' must be provided",
  });

export const mcpSearchItemsSchema = z.object({
  pattern: z
    .string()
    .min(1, "Pattern must not be empty")
    .max(500, "Pattern must be under 500 characters"),
  caseSensitive: z.boolean().optional(),
});

export const mcpCreateItemsSchema = z.object({
  items: z
    .array(
      z.object({
        title: titleSchema,
        url: urlSchema,
        notes: notesSchema.optional(),
      }),
    )
    .min(1, "Must provide at least one item")
    .max(50, "Cannot create more than 50 items at once"),
});

export const mcpUpdateItemsSchema = z.object({
  items: z
    .array(
      z.object({
        id: idSchema,
        title: titleSchema.optional(),
        url: urlSchema.optional(),
        notes: notesSchema.optional(),
        starred: z.boolean().optional(),
        read: z.boolean().optional(),
      }),
    )
    .min(1, "Must provide at least one item")
    .max(50, "Cannot update more than 50 items at once"),
});

export const mcpDeleteItemsSchema = z.object({
  ids: z
    .array(idSchema)
    .min(1, "Must provide at least one ID")
    .max(100, "Cannot delete more than 100 items at once"),
});

export const mcpGetFlashcardsSchema = z.object({
  itemId: idSchema,
});

export const mcpSearchFlashcardsSchema = z.object({
  query: z
    .string()
    .min(1, "Query must not be empty")
    .max(500, "Query must be under 500 characters"),
});
