"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function submitOAuthDecision(formData: FormData) {
  const decision = formData.get("decision") as string;
  const authorizationId = formData.get("authorization_id") as string;

  if (!authorizationId) {
    throw new Error("Missing authorization_id");
  }

  const supabase = await createClient();

  if (decision === "approve") {
    const { data, error } =
      await supabase.auth.oauth.approveAuthorization(authorizationId);
    if (error) throw new Error(error.message);
    redirect(data.redirect_url);
  } else {
    const { data, error } =
      await supabase.auth.oauth.denyAuthorization(authorizationId);
    if (error) throw new Error(error.message);
    redirect(data.redirect_url);
  }
}
