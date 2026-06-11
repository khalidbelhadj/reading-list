"use server";

import { createClient } from "@/lib/supabase/server";

export async function logout(scope: "local" | "global" = "local") {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope });
}
