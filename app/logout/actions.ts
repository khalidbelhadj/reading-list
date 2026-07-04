import { createServerFn } from "@tanstack/react-start";

const logoutFn = createServerFn({ method: "POST" })
  .validator((scope: "local" | "global") => scope)
  .handler(async ({ data: scope }) => {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    await supabase.auth.signOut({ scope });
  });

export const logout = (scope: "local" | "global" = "local") =>
  logoutFn({ data: scope });
