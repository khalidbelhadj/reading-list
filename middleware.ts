import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { updateSession } from "@/lib/supabase/middleware";
import "@/lib/env";

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
        for (const [key, value] of Object.entries(corsHeaders(request, isMcp))) {
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
      headers["WWW-Authenticate"] = `Bearer resource_metadata="${request.nextUrl.origin}/.well-known/oauth-protected-resource"`;
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

  // Skip auth for well-known endpoints, login page, and auth callback
  if (
    pathname.startsWith("/.well-known") ||
    pathname === "/login" ||
    pathname.startsWith("/auth/")
  ) {
    const response = NextResponse.next();
    await updateSession(request, response);
    return response;
  }

  // Skip auth for OAuth consent page (it handles its own auth check)
  if (pathname === "/oauth/consent") {
    const response = NextResponse.next();
    await updateSession(request, response);
    return response;
  }

  // Allow bypass in development with explicit mock user
  if (
    process.env.NODE_ENV === "development" &&
    process.env.MOCK_USER_ID
  ) {
    return NextResponse.next();
  }

  // Check session for web routes, redirect to login if unauthenticated
  const response = NextResponse.next();
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

function corsHeaders(request: NextRequest, isMcp: boolean): Record<string, string> {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, mcp-session-id",
    "Access-Control-Max-Age": "86400",
  };

  if (isMcp) {
    headers["Access-Control-Allow-Origin"] = origin ?? "*";
  } else if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }

  return headers;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
