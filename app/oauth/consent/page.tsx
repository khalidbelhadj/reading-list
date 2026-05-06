import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConsentForm } from "./consent-form";

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string }>;
}) {
  const { authorization_id: authorizationId } = await searchParams;

  if (!authorizationId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-destructive">Missing authorization_id</p>
      </div>
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
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-destructive">
          {error?.message || "Invalid authorization request"}
        </p>
      </div>
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
