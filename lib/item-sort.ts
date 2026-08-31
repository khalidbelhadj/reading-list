import { type Item } from "@/lib/types";

// Items created in the same instant (e.g. two MCP calls in one batch) have
// equal timestamps, so sorting by date alone is not a total order and they
// swap between refetches. Break ties by title, then id — mirroring the
// server's fetchItems ordering.
export const compareItems = (
  a: Item,
  b: Item,
  key: "createdAt" | "updatedAt" = "createdAt",
  direction: 1 | -1 = -1,
) =>
  direction * a[key].localeCompare(b[key]) ||
  a.title.localeCompare(b.title) ||
  a.id.localeCompare(b.id);
