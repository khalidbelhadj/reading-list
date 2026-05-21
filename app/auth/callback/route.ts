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
  // sign-in owns the PKCE verifier). Render an HTML page that hands the code
  // back through the readinglist:// protocol — a server-side 307 to a custom
  // scheme leaves the browser tab in a "still loading" state, so we ship a
  // real 200 response with a JS-triggered protocol navigation and a friendly
  // message + manual fallback link.
  if (from === "electron" && code) {
    const deepLink = new URL("readinglist://auth/complete");
    deepLink.searchParams.set("code", code);
    deepLink.searchParams.set("next", next);
    const deepLinkStr = deepLink.toString();
    const deepLinkJson = JSON.stringify(deepLinkStr);
    const deepLinkHtml = deepLinkStr.replace(/&/g, "&amp;");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Signed in — Reading List</title>
  <style>
    :root { color-scheme: light dark; }
    body {
      font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      margin: 0; padding: 4rem 1.5rem;
      display: flex; align-items: center; justify-content: center;
      min-height: 100dvh; background: Canvas; color: CanvasText;
    }
    .card { max-width: 22rem; text-align: center; }
    h1 { font-size: 1.125rem; font-weight: 600; margin: 0 0 0.5rem; }
    p  { margin: 0 0 1rem; color: GrayText; }
    a.button {
      display: inline-block; padding: 0.5rem 0.875rem;
      border: 1px solid currentColor; border-radius: 0.5rem;
      color: inherit; text-decoration: none; font-weight: 500;
    }
  </style>
</head>
<body>
  <main class="card">
    <h1>Signed in</h1>
    <p>You can close this tab and return to Reading List.</p>
    <p><a class="button" href="${deepLinkHtml}">Open Reading List</a></p>
  </main>
  <script>
    // Trigger the protocol immediately; browsers honor this when initiated
    // from the page's own script (vs. a server redirect to a custom scheme).
    window.location.href = ${deepLinkJson};
  </script>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
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
