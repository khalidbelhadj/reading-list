import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { ConsentForm } from "@/app/oauth/consent/consent-form";
import { NonIdealState } from "@/components/system/non-ideal-state";

type AuthorizationDetails =
  | { status: "unauthenticated" }
  | { status: "redirect"; url: string }
  | { status: "error"; message: string }
  | {
      status: "consent";
      clientName: string;
      redirectUri: string;
      scopes: string[];
    };

const getAuthorizationDetails = createServerFn({ method: "GET" })
  .validator((authorizationId: string) => authorizationId)
  .handler(async ({ data: authorizationId }): Promise<AuthorizationDetails> => {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { status: "unauthenticated" };

    const { data, error } =
      await supabase.auth.oauth.getAuthorizationDetails(authorizationId);

    if (error || !data) {
      return {
        status: "error",
        message: error?.message || "Invalid authorization request",
      };
    }

    // User already consented — redirect immediately.
    if ("redirect_url" in data) {
      return { status: "redirect", url: data.redirect_url };
    }

    return {
      status: "consent",
      clientName: data.client.name,
      redirectUri: data.redirect_uri,
      scopes: data.scope ? data.scope.split(" ") : [],
    };
  });

const ConsentPage = () => {
  const data = Route.useLoaderData();

  if (data.status === "missing") {
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

  if (data.status === "error") {
    return (
      <NonIdealState
        fullPage
        align="center"
        size="sm"
        tone="error"
        title={data.message}
        description="We couldn't verify this authorization request. Try connecting again from the app."
      />
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <ConsentForm
        authorizationId={data.authorizationId}
        clientName={data.clientName}
        redirectUri={data.redirectUri}
        scopes={data.scopes}
      />
    </div>
  );
};

export const Route = createFileRoute("/oauth/consent")({
  // Authorization details resolve server-side on first load (parity with the
  // old SSR consent page). The request middleware skips its auth redirect for
  // this path — unauthenticated users get bounced to /login here instead,
  // with a redirect back to this consent URL.
  ssr: "data-only",
  validateSearch: (
    search: Record<string, unknown>,
  ): { authorization_id?: string } => ({
    authorization_id:
      typeof search.authorization_id === "string"
        ? search.authorization_id
        : undefined,
  }),
  loaderDeps: ({ search }) => ({ authorizationId: search.authorization_id }),
  loader: async ({ deps }) => {
    if (!deps.authorizationId) return { status: "missing" as const };
    const details = await getAuthorizationDetails({
      data: deps.authorizationId,
    });
    if (details.status === "unauthenticated") {
      throw redirect({
        to: "/login",
        search: {
          error: undefined,
          redirect: `/oauth/consent?authorization_id=${deps.authorizationId}`,
        },
      });
    }
    if (details.status === "redirect") {
      throw redirect({ href: details.url });
    }
    return { ...details, authorizationId: deps.authorizationId };
  },
  component: ConsentPage,
});
