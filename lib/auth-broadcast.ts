import { createClient } from "@/lib/supabase/client";

// Per-user Realtime topic used to fan out a "you've been signed out" signal
// to the same user's other devices when they pick "Log out everywhere".
export const logoutChannelName = (userId: string) => `logout:${userId}`;

export const SIGNOUT_BROADCAST_EVENT = "signout";

// Tell this user's other devices to sign out. Best-effort: resolves once the
// broadcast is sent, on channel error, or after a short timeout, so it never
// blocks the actual sign-out flow.
export const broadcastSignOut = async () => {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return;

  const channel = supabase.channel(logoutChannelName(userId));
  await new Promise<void>((resolve) => {
    let settled = false;
    const timer: { id?: ReturnType<typeof setTimeout> } = {};
    const finish = () => {
      if (settled) return;
      settled = true;
      if (timer.id) clearTimeout(timer.id);
      supabase.removeChannel(channel);
      resolve();
    };
    timer.id = setTimeout(finish, 2000);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channel
          .send({
            type: "broadcast",
            event: SIGNOUT_BROADCAST_EVENT,
            payload: {},
          })
          .finally(finish);
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        finish();
      }
    });
  });
};
