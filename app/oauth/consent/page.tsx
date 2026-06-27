import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NonIdealState } from "@/components/ui/non-ideal-state";
import { ConsentForm } from "./consent-form";

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string }>;
}) {
  const { authorization_id: authorizationId } = await searchParams;

  if (!authorizationId) {
    return (
      <NonIdealState
        fullPage
        align="center"
        size="sm"
        tone="error"
        title="Missing authorization_id"
        description="This authorization link is incomplete. Start over from the app that sent you here."
      />
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?redirect=/oauth/consent?authorization_id=${authorizationId}`,
    );
  }

  const { data, error } =
    await supabase.auth.oauth.getAuthorizationDetails(authorizationId);

  if (error || !data) {
    return (
      <NonIdealState
        fullPage
        align="center"
        size="sm"
        tone="error"
        title={error?.message || "Invalid authorization request"}
        description="We couldn't verify this authorization request. Try connecting again from the app."
      />
    );
  }

  // User already consented — redirect immediately
  if ("redirect_url" in data) {
    redirect(data.redirect_url);
  }

  const scopes = data.scope ? data.scope.split(" ") : [];

  return (
    <div className="flex min-h-screen items-center justify-center">
      <ConsentForm
        authorizationId={authorizationId}
        clientName={data.client.name}
        redirectUri={data.redirect_uri}
        scopes={scopes}
      />
    </div>
  );
}
