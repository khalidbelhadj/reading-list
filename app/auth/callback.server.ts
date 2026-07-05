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

  // Electron flow: don't exchange the code here (the renderer that started the
  // sign-in owns the PKCE verifier). Hand the code to the /auth/return-to-app
  // page, which triggers the readinglist:// protocol from page JS so the
  // browser tab settles cleanly while the desktop app activates.
  if (from === "electron" && code) {
    const target = new URL("/auth/return-to-app", origin);
    target.searchParams.set("code", code);
    target.searchParams.set("next", next);
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
