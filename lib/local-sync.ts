// Same-machine sync between app windows (browser tabs / Electron child
// windows) over BroadcastChannel. Cross-device sync goes through Supabase
// Realtime (lib/items-sync.ts), but sibling windows never receive those
// broadcasts — they share the per-browser sync-origin id, so each window
// suppresses the others' writes as its own echo. This local layer fills that
// gap: windows mirror their React Query invalidations to each other (see
// components/local-sync-watcher.tsx), which is instant, free of server round
// trips, and works identically on the web and in Electron.

export const LOCAL_SYNC_CHANNEL = "local-sync";

// Top-level query keys worth mirroring across windows — shared server data
// only, matching the roots the Realtime watcher invalidates
// (queryKeysForTable in lib/items-sync.ts). Everything else (searches,
// previews) is window-local by design.
export const LOCAL_SYNC_KEYS = new Set(["items", "all-flashcards"]);

type LocalSyncMessage = { keys: string[] };

export const localSyncMessage = (keys: string[]): LocalSyncMessage => ({
  keys,
});

export const parseLocalSyncMessage = (data: unknown): string[] | null => {
  if (typeof data !== "object" || data === null) return null;
  const keys = (data as Partial<LocalSyncMessage>).keys;
  if (!Array.isArray(keys)) return null;
  const valid = keys.filter(
    (key): key is string => typeof key === "string" && LOCAL_SYNC_KEYS.has(key),
  );
  return valid.length > 0 ? valid : null;
};
