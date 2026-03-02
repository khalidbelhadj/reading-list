import { NextRequest, NextResponse } from "next/server";
import { isValidToken } from "@/lib/auth";

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

    // Check API key or auth cookie
    const apiKey = process.env.API_KEY;
    if (apiKey) {
      const auth = request.headers.get("authorization");
      const token = request.cookies.get("auth_token")?.value;
      const hasApiKey = auth === `Bearer ${apiKey}`;
      const hasCookie = token ? await isValidToken(token) : false;
      if (!hasApiKey && !hasCookie) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders(request) });
      }
    }

    const response = NextResponse.next();
    for (const [key, value] of Object.entries(corsHeaders(request))) {
      response.headers.set(key, value);
    }
    return response;
  }

  // Skip auth for login page
  if (pathname === "/login") {
    return NextResponse.next();
  }

  // Check auth cookie
  const token = request.cookies.get("auth_token")?.value;
  if (!token || !(await isValidToken(token))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
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
