"use client";

import { useQueryClient } from "@tanstack/react-query";
import React from "react";

import {
  ITEMS_SYNC_EVENT,
  itemsSyncChannelName,
  queryKeysForTable,
} from "@/lib/items-sync";
import { createClient } from "@/lib/supabase/client";

// Mounted once near the app root. Subscribes to the per-user Realtime topic
// that database triggers broadcast on whenever reading-list data changes (see
// drizzle/0011_items_sync_broadcast.sql) and invalidates the affected React
// Query caches, so changes made on another device (or via the MCP server)
// show up here without a reload.
export const ItemsSyncWatcher = () => {
  const queryClient = useQueryClient();

  React.useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
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

    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      if (!session || cancelled) return;
      // Private channels are authorized against RLS on realtime.messages,
      // which requires the user's JWT on the Realtime connection. Pass the
      // token explicitly — the client's automatic forwarding only runs on
      // SIGNED_IN/TOKEN_REFRESHED, not on the restored initial session, so
      // without this the join is attempted with the anon key and rejected.
      await supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;
      channel = supabase
        .channel(itemsSyncChannelName(session.user.id), {
          config: { private: true },
        })
        .on("broadcast", { event: ITEMS_SYNC_EVENT }, (message) => {
          const table = (message.payload as { table?: string } | undefined)
            ?.table;
          const keys = queryKeysForTable(table ?? "");
          if (keys.length === 0) return;
          keys.forEach((key) => pendingKeys.add(key));
          if (!flushTimer) flushTimer = setTimeout(flush, 250);
        })
        .subscribe((status, err) => {
          // Surface join failures — an RLS/auth rejection on the private
          // topic is otherwise indistinguishable from "no changes happened".
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn(`items-sync: channel ${status}`, err ?? "");
          }
        });
    });

    return () => {
      cancelled = true;
      if (flushTimer) clearTimeout(flushTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return null;
};
