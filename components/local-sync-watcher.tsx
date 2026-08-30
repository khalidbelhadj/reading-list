import { useQueryClient } from "@tanstack/react-query";
import React from "react";

import {
  LOCAL_SYNC_CHANNEL,
  LOCAL_SYNC_KEYS,
  localSyncMessage,
  parseLocalSyncMessage,
} from "@/lib/local-sync";
import { parseSettings, SETTINGS_STORAGE_KEY } from "@/lib/settings";

// Mounted once near the app root. Keeps sibling windows of the same browser
// (tabs on the web, child windows in Electron) live-synced by mirroring
// React Query invalidations over a BroadcastChannel: every mutation already
// encodes which caches it affects via its invalidateQueries calls, so
// re-broadcasting those events — filtered to the shared LOCAL_SYNC_KEYS —
// covers all current and future mutations without touching any of them.
// Cross-device changes still arrive via ItemsSyncWatcher; this handles the
// same-machine windows that the Realtime path deliberately skips (shared
// sync-origin id — see lib/local-sync.ts).
export const LocalSyncWatcher = () => {
  const queryClient = useQueryClient();

  React.useEffect(() => {
    // Absent only in very old browsers — they simply fall back to
    // refetch-on-focus, same as before this watcher existed.
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(LOCAL_SYNC_CHANNEL);

    // Re-entrancy guard: invalidations applied on behalf of another window
    // fire the same QueryCache events as local ones, and must not be
    // re-broadcast or two windows would ping-pong forever. Invalidation is
    // synchronous, so a plain flag around the loop is enough.
    let applyingRemote = false;

    // Bulk mutations invalidate several keys back-to-back — coalesce them
    // into one message.
    const pendingKeys = new Set<string>();
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      if (pendingKeys.size === 0) return;
      const keys = Array.from(pendingKeys);
      pendingKeys.clear();
      channel.postMessage(localSyncMessage(keys));
    };

    // A closing window's coalescing timer would otherwise drop pending
    // invalidations and leave sibling windows stale. pagehide fires while the window is still
    // scriptable, so flush any pending keys synchronously on the way out.
    const onPageHide = () => flush();
    window.addEventListener("pagehide", onPageHide);

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (applyingRemote) return;
      if (event.type !== "updated" || event.action.type !== "invalidate") {
        return;
      }
      const root = event.query.queryKey[0];
      if (typeof root !== "string" || !LOCAL_SYNC_KEYS.has(root)) return;
      pendingKeys.add(root);
      if (!flushTimer) flushTimer = setTimeout(flush, 100);
    });

    channel.onmessage = (event: MessageEvent) => {
      const keys = parseLocalSyncMessage(event.data);
      if (!keys) return;
      applyingRemote = true;
      try {
        for (const key of keys) {
          // Active queries refetch immediately; inactive ones on next mount.
          void queryClient.invalidateQueries({ queryKey: [key] });
        }
      } finally {
        applyingRemote = false;
      }
    };

    return () => {
      unsubscribe();
      window.removeEventListener("pagehide", onPageHide);
      if (flushTimer) clearTimeout(flushTimer);
      channel.close();
    };
  }, [queryClient]);

  // Settings bypass invalidation entirely (setQueryData + staleTime Infinity),
  // but use-settings writes every change to localStorage — and the browser
  // fires `storage` in every *other* same-origin window automatically. Adopt
  // the new value into this window's cache so toggles apply live everywhere.
  React.useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== SETTINGS_STORAGE_KEY || event.newValue == null) return;
      try {
        queryClient.setQueryData(
          ["settings"],
          parseSettings(JSON.parse(event.newValue)),
        );
      } catch {}
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [queryClient]);

  return null;
};
