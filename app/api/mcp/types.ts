/**
 * MCP response types.
 *
 * These describe the wire shape returned to MCP clients. They are intentionally
 * decoupled from the database schema — the agent only sees what we choose to
 * expose. Adding or removing a field here is a deliberate API surface change.
 */

export type McpItem = {
  id: string;
  title: string;
  url: string;
  notes: string | null;
  starred: boolean;
  read: boolean;
  tags: string[];
  createdAt: string;
};

export type McpSearchMatch = "title" | "url" | "notes" | "flashcards";

export type McpSearchItem = McpItem & {
  matchedIn: McpSearchMatch[];
};

export type McpFlashcard = {
  id: string;
  itemId: string | null;
  front: string;
  back: string;
  state: string;
  due: string;
};

type ItemSource = {
  id: string;
  title: string;
  url: string;
  notes: string | null;
  starred: boolean;
  read: boolean;
  createdAt: string;
};

export const toMcpItem = (item: ItemSource, tags: string[]): McpItem => ({
  id: item.id,
  title: item.title,
  url: item.url,
  notes: item.notes,
  starred: item.starred,
  read: item.read,
  tags,
  createdAt: item.createdAt,
});

export const toMcpSearchItem = (
  item: ItemSource,
  tags: string[],
  matchedIn: McpSearchMatch[],
): McpSearchItem => ({
  ...toMcpItem(item, tags),
  matchedIn,
});

type FlashcardSource = {
  id: string;
  itemId: string | null;
  front: string;
  back: string;
  state: string;
  due: string;
};

export const toMcpFlashcard = (card: FlashcardSource): McpFlashcard => ({
  id: card.id,
  itemId: card.itemId,
  front: card.front,
  back: card.back,
  state: card.state,
  due: card.due,
});

/**
 * Per-tool response types. Each MCP tool serializes one of these as JSON.
 *
 * Error / not-found cases are returned as plain text (not JSON) and are not
 * represented here — the types describe successful response shapes only.
 */

export type GetItemsResponse = {
  items: McpItem[];
  total: number;
  offset: number;
  limit: number | null;
};

export type GetItemByUrlResponse = McpItem;

export type SearchItemsResponse = {
  pattern: string;
  caseSensitive: boolean;
  total: number;
  truncated: boolean;
  items: McpSearchItem[];
};

export type CreateItemsResponse = {
  ids: string[];
};

export type UpdateItemsResponse = {
  updated: number;
  notFound: string[];
};

export type DeleteItemsResponse = {
  deleted: number;
  notFound: string[];
};

export type GetFlashcardsResponse = McpFlashcard[];

export type CreateFlashcardsResponse = {
  ids: string[];
  notFound: string[];
};

export type UpdateFlashcardsResponse = {
  updated: number;
};

export type DeleteFlashcardsResponse = {
  deleted: number;
};
