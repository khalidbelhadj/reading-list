import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { sanitizeRedirect } from "@/lib/url";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeRedirect(searchParams.get("next"));
  const from = searchParams.get("from");

  // Electron flow: don't exchange the code here (the renderer that started the
  // sign-in owns the PKCE verifier). Hand the code back via a deep link.
  if (from === "electron" && code) {
    const deepLink = new URL("readinglist://auth/complete");
    deepLink.searchParams.set("code", code);
    deepLink.searchParams.set("next", next);
    return new Response(null, {
      status: 307,
      headers: { Location: deepLink.toString() },
    });
  }

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          },
        },
      },
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("Auth callback error:", error.message);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
