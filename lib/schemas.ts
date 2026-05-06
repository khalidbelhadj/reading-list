import { z } from "zod";

export const parseInput = <T>(schema: z.ZodSchema<T>, data: unknown): T => {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(result.error.issues[0].message);
  }
  return result.data;
};

// Shared field schemas
const idSchema = z.string().min(1, "ID must not be empty");
const titleSchema = z.string().max(500, "Title must be under 500 characters");
const urlSchema = z.string().max(2048, "URL must be under 2048 characters");
const notesSchema = z.string().max(100000, "Notes must be under 100,000 characters");
const tagNameSchema = z.string().max(100, "Tag name must be under 100 characters");
const tagNamesSchema = z.array(tagNameSchema).max(50, "Cannot have more than 50 tags");
const flashcardTextSchema = z.string().max(10000, "Flashcard text must be under 10,000 characters");
const limitSchema = z.number().int("Limit must be an integer").min(1, "Limit must be at least 1").max(100, "Limit must be at most 100");

// Server action schemas
export const deleteItemSchema = z.object({
  itemId: idSchema,
});

export const fetchPageTitleSchema = z.object({
  url: urlSchema,
});

export const createItemSchema = z.object({
  title: titleSchema,
  url: urlSchema,
  tagNames: tagNamesSchema,
  faviconUrl: urlSchema.optional(),
  notes: notesSchema.optional(),
  id: idSchema.optional(),
  position: z.number().int().min(0).optional(),
});

export const updateItemSchema = z.object({
  itemId: idSchema,
  fields: z.object({
    title: titleSchema.optional(),
    url: urlSchema.optional(),
    faviconUrl: urlSchema.optional(),
    starred: z.boolean().optional(),
    notes: notesSchema.optional(),
    read: z.boolean().optional(),
    tagNames: tagNamesSchema.optional(),
  }),
});

export const reorderItemSchema = z.object({
  itemId: idSchema,
  newPosition: z.number().int("Position must be an integer").min(0, "Position must be non-negative"),
});

export const toggleReadSchema = z.object({
  itemId: idSchema,
  read: z.boolean(),
});

export const bulkDeleteItemsSchema = z.object({
  itemIds: z.array(idSchema).max(100, "Cannot delete more than 100 items at once"),
});

export const bulkTagSchema = z.object({
  itemIds: z.array(idSchema).max(100, "Cannot tag more than 100 items at once"),
  tagNames: tagNamesSchema,
});

export const bulkMarkReadSchema = z.object({
  itemIds: z.array(idSchema).max(100, "Cannot update more than 100 items at once"),
  read: z.boolean(),
});

export const renameTagSchema = z.object({
  tagId: z.number().int(),
  newName: tagNameSchema,
});

export const deleteTagSchema = z.object({
  tagId: z.number().int(),
});

export const getFlashcardsSchema = z.object({
  itemId: idSchema,
});

export const createFlashcardSchema = z.object({
  itemId: idSchema,
  front: flashcardTextSchema,
  back: flashcardTextSchema,
});

export const updateFlashcardSchema = z.object({
  id: idSchema,
  fields: z.object({
    front: flashcardTextSchema.optional(),
    back: flashcardTextSchema.optional(),
  }),
});

export const deleteFlashcardSchema = z.object({
  id: idSchema,
});

export const startReviewSessionSchema = z.object({
  mode: z.enum(["due", "cram", "item", "new", "filter"]),
  scope: z.object({
    itemId: idSchema.optional(),
    tagIds: z.array(z.number().int()).optional(),
  }).optional(),
  limit: limitSchema.optional(),
});

export const rateCardSchema = z.object({
  sessionId: idSchema,
  flashcardId: idSchema,
  rating: z.enum(["again", "hard", "good", "easy"], { message: "Rating must be 1-4 (again, hard, good, easy)" }),
  durationMs: z.number().int("Duration must be an integer").min(0, "Duration must be non-negative").max(600000, "Duration must be at most 10 minutes"),
  timeToRevealMs: z.number().int().min(0).max(600000).nullable(),
});

export const skipCardSchema = z.object({
  sessionId: idSchema,
  flashcardId: idSchema,
  afterReveal: z.boolean(),
  durationMs: z.number().int("Duration must be an integer").min(0, "Duration must be non-negative").max(600000, "Duration must be at most 10 minutes"),
});

export const endReviewSessionSchema = z.object({
  sessionId: idSchema,
  reason: z.enum(["completed", "user_ended"]),
});

export const logSessionEventSchema = z.object({
  sessionId: idSchema,
  event: z.discriminatedUnion("type", [
    z.object({ type: z.literal("card_shown"), flashcardId: idSchema, data: z.null() }),
    z.object({ type: z.literal("answer_revealed"), flashcardId: idSchema, data: z.object({ timeToRevealMs: z.number().int().min(0) }) }),
    z.object({ type: z.literal("card_skipped"), flashcardId: idSchema, data: z.object({ afterReveal: z.boolean(), durationMs: z.number().int().min(0).max(600000) }) }),
    z.object({ type: z.literal("card_edited_during_review"), flashcardId: idSchema, data: z.object({ fieldsChanged: z.array(z.enum(["front", "back"])) }) }),
    z.object({ type: z.literal("session_paused"), flashcardId: z.null(), data: z.null() }),
    z.object({ type: z.literal("session_resumed"), flashcardId: z.null(), data: z.object({ pauseDurationMs: z.number().int().min(0) }) }),
    z.object({ type: z.literal("session_ended"), flashcardId: z.null(), data: z.object({ reason: z.enum(["completed", "user_ended", "abandoned"]) }) }),
  ]),
});

export const getReviewSessionSchema = z.object({
  sessionId: idSchema,
});

export const getSessionSummarySchema = z.object({
  sessionId: idSchema,
});

export const getDueCardsSchema = z.object({
  limit: limitSchema.optional(),
});

export const getNewCardsSchema = z.object({
  limit: limitSchema.optional(),
});

export const getCardsForItemSchema = z.object({
  itemId: idSchema,
});

// MCP tool schemas
export const mcpGetItemsSchema = z.object({
  sort: z.enum(["position", "created_at", "updated_at", "title"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  tag: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});

export const mcpGetItemByUrlSchema = z.object({
  url: urlSchema,
});

export const mcpSearchItemsSchema = z.object({
  pattern: z.string().min(1, "Pattern must not be empty").max(500, "Pattern must be under 500 characters"),
  caseSensitive: z.boolean().optional(),
});

export const mcpCreateItemsSchema = z.object({
  items: z.array(z.object({
    title: titleSchema,
    url: urlSchema,
    tagNames: tagNamesSchema.optional(),
    notes: notesSchema.optional(),
  })).min(1, "Must provide at least one item").max(50, "Cannot create more than 50 items at once"),
});

export const mcpUpdateItemsSchema = z.object({
  items: z.array(z.object({
    id: idSchema,
    title: titleSchema.optional(),
    url: urlSchema.optional(),
    notes: notesSchema.optional(),
    tagNames: tagNamesSchema.optional(),
  })).min(1, "Must provide at least one item").max(50, "Cannot update more than 50 items at once"),
});

export const mcpDeleteItemsSchema = z.object({
  ids: z.array(idSchema).min(1, "Must provide at least one ID").max(100, "Cannot delete more than 100 items at once"),
});

export const mcpGetFlashcardsSchema = z.object({
  itemId: idSchema,
});

export const mcpCreateFlashcardsSchema = z.object({
  flashcards: z.array(z.object({
    itemId: idSchema,
    front: flashcardTextSchema,
    back: flashcardTextSchema,
  })).min(1, "Must provide at least one flashcard").max(50, "Cannot create more than 50 flashcards at once"),
});

export const mcpUpdateFlashcardsSchema = z.object({
  flashcards: z.array(z.object({
    id: idSchema,
    front: flashcardTextSchema.optional(),
    back: flashcardTextSchema.optional(),
  })).min(1, "Must provide at least one flashcard").max(50, "Cannot update more than 50 flashcards at once"),
});

export const mcpDeleteFlashcardsSchema = z.object({
  ids: z.array(idSchema).min(1, "Must provide at least one ID").max(100, "Cannot delete more than 100 flashcards at once"),
});
