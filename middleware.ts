import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // CORS for API routes
  if (pathname.startsWith("/api/")) {
    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: corsHeaders(request),
      });
    }

    // Check API key first (for MCP / extension clients)
    const apiKey = process.env.API_KEY;
    if (apiKey) {
      const auth = request.headers.get("authorization");
      if (auth === `Bearer ${apiKey}`) {
        const response = NextResponse.next();
        for (const [key, value] of Object.entries(corsHeaders(request))) {
          response.headers.set(key, value);
        }
        return response;
      }
    }

    // Fall back to Supabase session
    const response = NextResponse.next();
    const { user } = await updateSession(request, response);
    if (!user) {
      const headers = corsHeaders(request);
      headers["WWW-Authenticate"] = `Bearer resource_metadata="${request.nextUrl.origin}/.well-known/oauth-protected-resource"`;
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers },
      );
    }

    for (const [key, value] of Object.entries(corsHeaders(request))) {
      response.headers.set(key, value);
    }
    return response;
  }

  // Skip auth for well-known endpoints, login page, and auth callback
  if (pathname.startsWith("/.well-known") || pathname === "/login" || pathname.startsWith("/auth/")) {
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

  // Check Supabase session for all other pages
  const response = NextResponse.next();
  const { user } = await updateSession(request, response);

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

function corsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
