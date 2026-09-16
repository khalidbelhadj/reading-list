import { createClient } from "@/lib/supabase/server";
import { sanitizeRedirect } from "@/lib/url";

const redirect = (location: string) =>
  new Response(null, { status: 302, headers: { Location: location } });

// Google OAuth code exchange. Served by the /auth/callback server route. The
// session cookies written by exchangeCodeForSession attach to the redirect
// response via the request-scoped cookie helpers in lib/supabase/server.
export async function handleAuthCallback(request: Request): Promise<Response> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeRedirect(searchParams.get("next"));
  const from = searchParams.get("from");
  const scheme = searchParams.get("scheme") ?? "";

  // Desktop flow (Electron and the Mac app): don't exchange the code here,
  // the app that started the sign-in owns the PKCE verifier. Hand the code
  // to the /auth/return-to-app page, which opens the app's url scheme from
  // page JS so the browser tab settles cleanly while the app activates.
  // Only the app's own schemes are ever opened.
  if ((from === "desktop" || from === "electron") && code) {
    const target = new URL("/auth/return-to-app", origin);
    target.searchParams.set("code", code);
    target.searchParams.set("next", next);
    if (/^readinglist(-mac)?(-dev)?$/.test(scheme))
      target.searchParams.set("scheme", scheme);
    return redirect(target.toString());
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return redirect(`${origin}${next}`);
    }
    console.error("Auth callback error:", error.message);
  }

  return redirect(`${origin}/login?error=auth`);
}
