import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { updateSession } from "@/lib/supabase/middleware";
import "@/lib/env";

// Per-request CSP nonce. Next.js streams its RSC payload via inline
// <script>self.__next_f.push(...)</script> tags whose bodies change per
// request, so static hashes can't cover them. With 'strict-dynamic', any
// script tag carrying this nonce (including the ones Next.js generates) is
// allowed; everything else is blocked.
const buildCsp = (nonce: string): string => {
  // Standalone React DevTools (`bun x react-devtools`) serves its agent over
  // http://localhost:8097 and the page then opens a WebSocket back to it.
  // Only in development, and only the connect-src needs widening — the script
  // tag itself is allowed via its nonce.
  const devtools =
    process.env.NODE_ENV === "development"
      ? " http://localhost:8097 ws://localhost:8097"
      : "";
  // Turbopack's Fast Refresh runtime uses eval() in development (React dev
  // tooling needs it to reconstruct call stacks, etc.). Without 'unsafe-eval'
  // the strict CSP blocks it and every edit falls back to a full page reload
  // instead of hot-swapping. Dev-only — production CSP stays eval-free.
  const devEval =
    process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${devEval}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https: data: blob:",
    "font-src 'self'",
    // Schemeless sources only match http(s) — wss: must be listed explicitly
    // or the browser blocks Supabase Realtime's WebSocket.
    `connect-src 'self' *.supabase.co wss://*.supabase.co${devtools}`,
    "frame-src 'self' accounts.google.com",
    "frame-ancestors 'none'",
    "form-action 'self' accounts.google.com",
    "base-uri 'self'",
    "object-src 'none'",
  ];
  return directives.join("; ");
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // CORS for API routes
  if (pathname.startsWith("/api/")) {
    const isMcp = pathname.startsWith("/api/mcp");

    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: corsHeaders(request, isMcp),
      });
    }

    // Check for Supabase OAuth Bearer token (MCP clients, extensions)
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll: () => [],
            setAll: () => {},
          },
        },
      );
      const {
        data: { user },
      } = await supabase.auth.getUser(token);
      if (user) {
        const response = NextResponse.next();
        for (const [key, value] of Object.entries(
          corsHeaders(request, isMcp),
        )) {
          response.headers.set(key, value);
        }
        return response;
      }
    }

    // Fall back to Supabase cookie session
    const response = NextResponse.next();
    const { user } = await updateSession(request, response);
    if (!user) {
      const headers = corsHeaders(request, isMcp);
      headers["WWW-Authenticate"] =
        `Bearer resource_metadata="${request.nextUrl.origin}/.well-known/oauth-protected-resource"`;
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers },
      );
    }

    for (const [key, value] of Object.entries(corsHeaders(request, isMcp))) {
      response.headers.set(key, value);
    }
    return response;
  }

  // HTML routes from here on — apply per-request CSP nonce.
  // Forward x-nonce on the *request* so Next.js can pick it up during SSR.
  const requestHeaders = new Headers(request.headers);
  const nonce = crypto.randomUUID().replace(/-/g, "");
  requestHeaders.set("x-nonce", nonce);

  const passThrough = (): NextResponse => {
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    response.headers.set("Content-Security-Policy", buildCsp(nonce));
    return response;
  };

  // Skip auth for well-known endpoints, login page, auth callback, and
  // static files served from /public
  if (
    pathname.startsWith("/.well-known") ||
    pathname === "/login" ||
    pathname.startsWith("/auth/") ||
    /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf|otf|map|txt|json)$/i.test(
      pathname,
    )
  ) {
    const response = passThrough();
    await updateSession(request, response);
    return response;
  }

  // Skip auth for OAuth consent page (it handles its own auth check)
  if (pathname === "/oauth/consent") {
    const response = passThrough();
    await updateSession(request, response);
    return response;
  }

  // Allow bypass in development with explicit mock user
  if (process.env.NODE_ENV === "development" && process.env.MOCK_USER_ID) {
    return passThrough();
  }

  // Check session for web routes, redirect to login if unauthenticated
  const response = passThrough();
  const { user } = await updateSession(request, response);
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return response;
}

const ALLOWED_ORIGINS = (() => {
  const env = process.env.ALLOWED_ORIGINS;
  const origins = env ? env.split(",").map((o) => o.trim()) : [];
  origins.push("http://localhost:3000");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    origins.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }
  return new Set(origins);
})();

function corsHeaders(
  request: NextRequest,
  isMcp: boolean,
): Record<string, string> {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, mcp-session-id",
    "Access-Control-Max-Age": "86400",
  };

  // Chrome extensions call with credentials (cookie session), so the response
  // must echo the specific origin and allow credentials — never "*".
  const isExtension = origin?.startsWith("chrome-extension://");

  if (isMcp) {
    headers["Access-Control-Allow-Origin"] = origin ?? "*";
  } else if (origin && (ALLOWED_ORIGINS.has(origin) || isExtension)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
    headers["Vary"] = "Origin";
  }

  return headers;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
