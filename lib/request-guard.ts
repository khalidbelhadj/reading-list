// Server-only port of the old Next.js middleware.ts: CORS + auth for /api/*,
// session refresh + login redirect for pages, per-request CSP nonce, and the
// static security headers that used to live in next.config.ts. Invoked by the
// global request middleware in app/start.ts (via dynamic import so none of
// this reaches the client bundle).
import "@/lib/env";

import {
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
} from "@supabase/ssr";

// Per-request CSP nonce. TanStack Start streams its hydration payload via
// inline <script> tags whose bodies change per request, so static hashes
// can't cover them. The router is given the nonce (see app/router.tsx), so
// every framework-emitted script tag carries it; with 'strict-dynamic',
// anything those scripts load (route chunks) is allowed too — everything
// else is blocked.
const buildCsp = (nonce: string): string => {
  // Standalone React DevTools (`bun x react-devtools`) serves its agent over
  // http://localhost:8097 and the page then opens a WebSocket back to it.
  // Vite's HMR client also needs a same-host WebSocket in dev. Dev-only.
  const devConnect =
    process.env.NODE_ENV === "development"
      ? " http://localhost:8097 ws://localhost:8097 ws://localhost:* http://localhost:*"
      : "";
  // React dev tooling can rely on eval() to reconstruct call stacks; dev-only
  // — the production CSP stays eval-free.
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
    `connect-src 'self' *.supabase.co wss://*.supabase.co${devConnect}`,
    // https:: the in-app viewer (/read/:itemId) embeds the item's real page
    // in an iframe pane (mini browser) plus the youtube-nocookie player;
    // frames are sandboxed at the element level in components/viewer/.
    "frame-src 'self' accounts.google.com https:",
    "frame-ancestors 'none'",
    "form-action 'self' accounts.google.com",
    "base-uri 'self'",
    "object-src 'none'",
    // pdf.js renders in a worker (custom PDF viewer); vite serves it same-
    // origin in prod and may wrap it in a blob in dev.
    "worker-src 'self' blob:",
  ];
  return directives.join("; ");
};

// Static security headers, applied to every response (they lived in
// next.config.ts headers() before).
const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

const ALLOWED_ORIGINS = (() => {
  const env = process.env.ALLOWED_ORIGINS;
  const origins = env ? env.split(",").map((o) => o.trim()) : [];
  origins.push("http://localhost:3000");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    origins.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }
  return new Set(origins);
})();

const corsHeaders = (
  request: Request,
  isMcp: boolean,
): Record<string, string> => {
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
};

const applyHeaders = (
  response: Response,
  headers: Record<string, string>,
): void => {
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
};

// Equivalent of the old lib/supabase/middleware.ts updateSession: reads the
// session from request cookies, lets supabase refresh it if needed, and
// collects the resulting Set-Cookie values to append to whatever response we
// end up returning.
//
// Uses getClaims() rather than getUser() so the token is verified locally
// instead of round-tripping to Supabase Auth on every page and API request
// (see lib/auth.ts for the full rationale). getClaims still refreshes a
// near-expiry session before validating, so the Set-Cookie behaviour that
// keeps sessions alive is unchanged.
const getSessionFromRequest = async (request: Request) => {
  const setCookies: string[] = [];
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () =>
          parseCookieHeader(request.headers.get("cookie") ?? "").map(
            ({ name, value }) => ({ name, value: value ?? "" }),
          ),
        setAll: (cookiesToSet) => {
          for (const { name, value, options } of cookiesToSet) {
            setCookies.push(serializeCookieHeader(name, value, options));
          }
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();

  return { userId: data?.claims.sub ?? null, setCookies };
};

const applySetCookies = (response: Response, setCookies: string[]): void => {
  for (const cookie of setCookies) {
    response.headers.append("Set-Cookie", cookie);
  }
};

// Paths served without a session: OAuth metadata, login, auth callbacks, and
// static files (anything in /public that falls through to the handler).
const isPublicPath = (pathname: string): boolean =>
  pathname.startsWith("/.well-known") ||
  pathname === "/login" ||
  pathname.startsWith("/auth/") ||
  pathname === "/oauth/consent" ||
  /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf|otf|map|txt|json)$/i.test(
    pathname,
  );

// Per-request phase timings, surfaced as a Server-Timing header so prod
// latency is attributable straight from a browser (or the extension's)
// network panel: `auth` is session resolution, `handler` is everything the
// route itself does. Dev perfLog output only covers the server functions,
// and MOCK_USER_ID skips auth entirely there — this is the only view of
// what auth actually costs against a real Supabase project.
const serverTiming = (marks: [string, number][]): string =>
  marks.map(([name, ms]) => `${name};dur=${ms.toFixed(1)}`).join(", ");

type GuardNextResult = { response: Response };

export async function guardRequest<TResult extends GuardNextResult>(opts: {
  request: Request;
  pathname: string;
  handlerType: "serverFn" | "router";
  next: (nextOpts?: {
    context?: { cspNonce: string };
  }) => Promise<TResult> | TResult;
}): Promise<TResult | Response> {
  const { request, pathname, handlerType, next } = opts;

  // Server-function calls skip the page/API gates: every server function
  // authenticates itself via getCurrentUserId (an expired session surfaces as
  // an "Unauthorized" error the client reacts to), and the CSRF middleware
  // in app/start.ts rejects cross-site calls before this runs.
  if (handlerType === "serverFn") {
    return next();
  }

  // CORS + auth for API routes.
  if (pathname.startsWith("/api/")) {
    const isMcp = pathname.startsWith("/api/mcp");
    // The in-app viewer embeds the PDF proxy in a same-origin <iframe>; the
    // blanket X-Frame-Options: DENY would make the browser refuse our own
    // response (ERR_BLOCKED_BY_RESPONSE).
    const securityHeaders =
      pathname === "/api/proxy-pdf"
        ? {
            ...SECURITY_HEADERS,
            "X-Frame-Options": "SAMEORIGIN",
            "Content-Security-Policy": "frame-ancestors 'self'",
          }
        : SECURITY_HEADERS;

    if (request.method === "OPTIONS") {
      return new Response(null, {
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
        { cookies: { getAll: () => [], setAll: () => {} } },
      );
      const authStart = performance.now();
      const { data } = await supabase.auth.getClaims(token);
      const authMs = performance.now() - authStart;
      if (data?.claims.sub) {
        const handlerStart = performance.now();
        const result = await next();
        applyHeaders(result.response, {
          ...securityHeaders,
          ...corsHeaders(request, isMcp),
          "Server-Timing": serverTiming([
            ["auth", authMs],
            ["handler", performance.now() - handlerStart],
          ]),
        });
        return result;
      }
    }

    // Dev bypass: with an explicit mock user there is no real Supabase session,
    // so let same-origin API calls through (mirrors the page-route bypass
    // below). The routes themselves resolve the mock user via getCurrentUserId.
    if (process.env.NODE_ENV === "development" && process.env.MOCK_USER_ID) {
      const result = await next();
      applyHeaders(result.response, {
        ...securityHeaders,
        ...corsHeaders(request, isMcp),
      });
      return result;
    }

    // Fall back to Supabase cookie session
    const authStart = performance.now();
    const { userId, setCookies } = await getSessionFromRequest(request);
    const authMs = performance.now() - authStart;
    if (!userId) {
      const headers = corsHeaders(request, isMcp);
      headers["WWW-Authenticate"] =
        `Bearer resource_metadata="${new URL(request.url).origin}/.well-known/oauth-protected-resource"`;
      return Response.json({ error: "Unauthorized" }, { status: 401, headers });
    }

    const handlerStart = performance.now();
    const result = await next();
    applyHeaders(result.response, {
      ...securityHeaders,
      ...corsHeaders(request, isMcp),
      "Server-Timing": serverTiming([
        ["auth", authMs],
        ["handler", performance.now() - handlerStart],
      ]),
    });
    applySetCookies(result.response, setCookies);
    return result;
  }

  // HTML routes from here on — per-request CSP nonce, forwarded to the router
  // (app/router.tsx) via middleware context so every SSR-emitted script tag
  // carries it.
  const nonce = crypto.randomUUID().replace(/-/g, "");

  const finish = async (
    setCookies: string[],
    authMs: number,
  ): Promise<TResult> => {
    const handlerStart = performance.now();
    const result = await next({ context: { cspNonce: nonce } });
    applyHeaders(result.response, SECURITY_HEADERS);
    result.response.headers.set("Content-Security-Policy", buildCsp(nonce));
    result.response.headers.set(
      "Server-Timing",
      serverTiming([
        ["auth", authMs],
        ["handler", performance.now() - handlerStart],
      ]),
    );
    applySetCookies(result.response, setCookies);
    return result;
  };

  // Public paths still refresh the session cookie, but never redirect.
  if (isPublicPath(pathname)) {
    const publicAuthStart = performance.now();
    const { setCookies } = await getSessionFromRequest(request);
    return finish(setCookies, performance.now() - publicAuthStart);
  }

  // Allow bypass in development with explicit mock user
  if (process.env.NODE_ENV === "development" && process.env.MOCK_USER_ID) {
    return finish([], 0);
  }

  // Check session for web routes, redirect to login if unauthenticated
  const authStart = performance.now();
  const { userId, setCookies } = await getSessionFromRequest(request);
  const authMs = performance.now() - authStart;
  if (!userId) {
    return new Response(null, {
      status: 307,
      headers: { Location: new URL("/login", request.url).toString() },
    });
  }
  return finish(setCookies, authMs);
}
