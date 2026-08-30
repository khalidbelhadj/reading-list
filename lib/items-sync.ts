// Per-user Realtime topic that database triggers broadcast on whenever
// reading-list data changes — regardless of entry point (web UI server
// actions, the MCP server, manual SQL). The sending side lives in
// db/setup.sql (the items_sync_notify trigger); the receiving side is
// components/items-sync-watcher.tsx.
export const itemsSyncChannelName = (userId: string) => `items-sync:${userId}`;

// Must match the event name passed to realtime.send() in the trigger.
export const ITEMS_SYNC_EVENT = "data-changed";

// Stable per-browser id identifying this client as the origin of its own
// writes. Sent to the server as the `sync-origin` cookie; withUser() forwards
// it into the transaction and the items_sync_notify trigger stamps broadcasts
// with it, letting this client skip the echo of writes it already handled via
// its own mutation invalidations. Shared across tabs of one browser — a
// sibling tab misses the ping but catches up via the default
// refetch-on-window-focus. Client-only (localStorage + document.cookie).
const SYNC_ORIGIN_KEY = "sync-origin-id";
export const getSyncOriginId = (): string => {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(SYNC_ORIGIN_KEY);
  if (!id || !/^[a-zA-Z0-9-]{1,64}$/.test(id)) {
    id = crypto.randomUUID();
    window.localStorage.setItem(SYNC_ORIGIN_KEY, id);
  }
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `sync-origin=${id}; path=/; SameSite=Lax; max-age=31536000${secure}`;
  return id;
};

// React Query cache roots a change to each table can affect. The items query
// embeds flashcard counts, so flashcard changes invalidate ["items"] too. An
// in-progress review run is deliberately unaffected — the pane freezes its
// queue on entry.
export const queryKeysForTable = (table: string): string[] => {
  switch (table) {
    case "items":
      // "item-previews" is deliberately NOT invalidated here: the preview map
      // is a ~2.4MB payload and generic item writes never change it. Previews
      // change only via generateItemPreview, which invalidates its own cache
      // on the device that generated it; other devices pick new previews up
      // on the next preview-mode mount.
      return ["items"];
    case "flashcards":
      return ["items", "all-flashcards"];
    default:
      return [];
  }
};
