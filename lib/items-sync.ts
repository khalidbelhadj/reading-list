// Per-user Realtime topic that database triggers broadcast on whenever
// reading-list data changes — regardless of entry point (web UI server
// actions, the MCP server, manual SQL). The sending side lives in
// db/setup.sql (the items_sync_notify trigger); the receiving side is
// components/items-sync-watcher.tsx.
export const itemsSyncChannelName = (userId: string) => `items-sync:${userId}`;

// Must match the event name passed to realtime.send() in the trigger.
export const ITEMS_SYNC_EVENT = "data-changed";

// React Query cache roots a change to each table can affect. The items query
// embeds tags and flashcard counts, so tag/join/flashcard changes invalidate
// ["items"] too. Review-session queries are deliberately excluded — they pin
// their data for the duration of a session.
export const queryKeysForTable = (table: string): string[] => {
  switch (table) {
    case "items":
    case "tags":
    case "items_tags":
      // "item-previews" is a separate, cozy-only cache; invalidating it when
      // it has no observers is a no-op until cozy mode mounts again.
      return ["items", "item-previews"];
    case "flashcards":
      return [
        "items",
        "all-flashcards",
        "flashcards",
        "review-status",
        "item-review-status",
      ];
    default:
      return [];
  }
};
