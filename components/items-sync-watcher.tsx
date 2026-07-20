import { useQueryClient } from "@tanstack/react-query";
import React from "react";

import {
  getSyncOriginId,
  ITEMS_SYNC_EVENT,
  itemsSyncChannelName,
  queryKeysForTable,
} from "@/lib/items-sync";
import { createClient } from "@/lib/supabase/client";

// Mounted once near the app root. Subscribes to the per-user Realtime topic
// that database triggers broadcast on whenever reading-list data changes (see
// the items_sync_notify trigger in db/setup.sql) and invalidates the affected React
// Query caches, so changes made on another device (or via the MCP server)
// show up here without a reload.
export const ItemsSyncWatcher = () => {
  const queryClient = useQueryClient();

  React.useEffect(() => {
    const supabase = createClient();
    // Also (re)plants the sync-origin cookie the server reads in withUser().
    const originId = getSyncOriginId();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let subscribedUserId: string | null = null;
    let cancelled = false;

    // The trigger fires per changed row, so bulk operations arrive as a
    // burst of pings — coalesce them into one invalidation pass.
    const pendingKeys = new Set<string>();
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      flushTimer = null;
      for (const key of pendingKeys) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      pendingKeys.clear();
    };

    const teardown = () => {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      pendingKeys.clear();
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
      subscribedUserId = null;
    };

    const subscribe = async (userId: string, accessToken: string) => {
      if (cancelled || subscribedUserId === userId) return;
      // A different user signed in (or a stale channel exists) — drop it first.
      teardown();
      subscribedUserId = userId;
      // Private channels are authorized against RLS on realtime.messages,
      // which requires the user's JWT on the Realtime connection. Pass the
      // token explicitly — the client's automatic forwarding only runs on
      // SIGNED_IN/TOKEN_REFRESHED, not on the restored initial session, so
      // without this the join is attempted with the anon key and rejected.
      await supabase.realtime.setAuth(accessToken);
      if (cancelled || subscribedUserId !== userId) return;
      channel = supabase
        .channel(itemsSyncChannelName(userId), { config: { private: true } })
        .on("broadcast", { event: ITEMS_SYNC_EVENT }, (message) => {
          const payload = message.payload as
            { table?: string; origin?: string } | undefined;
          // Our own write echoing back — the local mutation already
          // invalidated the affected caches; skip the redundant refetch pass.
          if (payload?.origin && payload.origin === originId) return;
          const keys = queryKeysForTable(payload?.table ?? "");
          if (keys.length === 0) return;
          keys.forEach((key) => pendingKeys.add(key));
          if (!flushTimer) flushTimer = setTimeout(flush, 250);
        })
        .subscribe((status, err) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn("[items-sync] channel error:", status, err ?? "");
          }
        });
    };

    // Re-evaluate the subscription on every auth change: subscribe on the
    // initial session / sign-in / token refresh, tear down on sign-out. A
    // one-shot getSession() would miss a login that happens after mount and
    // would never re-auth the channel across a sign-out/sign-in.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        void subscribe(session.user.id, session.access_token);
      } else {
        teardown();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      teardown();
    };
  }, [queryClient]);

  return null;
};
