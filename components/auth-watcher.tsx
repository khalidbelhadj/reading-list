import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import React from "react";

import {
  logoutChannelName,
  SIGNOUT_BROADCAST_EVENT,
} from "@/lib/auth-broadcast";
import { createClient } from "@/lib/supabase/client";

// Mounted once near the app root. Reacts to auth state changes (covers
// same-browser tabs for free) and subscribes to a per-user Realtime channel so
// a "Log out everywhere" on another device evicts this one in near-real-time
// instead of waiting for the next token refresh to fail.
export const AuthWatcher = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        queryClient.clear();
        navigate({ to: "/login", replace: true });
      }
    });

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    supabase.auth.getUser().then(({ data }) => {
      const userId = data.user?.id;
      if (!userId || cancelled) return;
      channel = supabase
        .channel(logoutChannelName(userId))
        .on("broadcast", { event: SIGNOUT_BROADCAST_EVENT }, () => {
          // Clearing the local session fires SIGNED_OUT above, which handles
          // the cache clear and redirect.
          supabase.auth.signOut({ scope: "local" });
        })
        .subscribe();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, [queryClient, navigate]);

  return null;
};
