import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { LoginForm } from "@/app/login/login-form";
import { sanitizeRedirect } from "@/lib/url";

const getIsAuthenticated = createServerFn({ method: "GET" }).handler(
  async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return !!user;
  },
);

const LoginPage = () => {
  const { error, redirect: redirectTo } = Route.useSearch();
  return (
    <div className="flex min-h-dvh items-center justify-center px-5">
      <LoginForm error={!!error} redirectTo={redirectTo} />
    </div>
  );
};

export const Route = createFileRoute("/login")({
  // Run the already-signed-in redirect server-side on first load (parity with
  // the old SSR login page); the form itself renders client-only.
  ssr: "data-only",
  validateSearch: (
    search: Record<string, unknown>,
  ): { error?: string; redirect?: string } => ({
    error: typeof search.error === "string" ? search.error : undefined,
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  beforeLoad: async ({ search }) => {
    if (await getIsAuthenticated()) {
      throw redirect({ href: sanitizeRedirect(search.redirect ?? null) });
    }
  },
  component: LoginPage,
});
