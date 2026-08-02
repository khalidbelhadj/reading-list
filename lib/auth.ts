import { createServerClient } from "@supabase/ssr";

import { perfLog } from "@/lib/perf";
import { createClient } from "@/lib/supabase/server";

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

const getMockUserId = (): string | null => {
  if (process.env.NODE_ENV !== "development") return null;
  return process.env.MOCK_USER_ID ?? null;
};

// getClaims() verifies the access token's signature locally (WebCrypto,
// against a JWKS cached per server instance) whenever the Supabase project
// signs with asymmetric keys — no network hop. The getUser() this replaced
// always round-tripped to /auth/v1/user, which put ~30ms of Supabase Auth
// latency on the critical path of every server function and API route.
//
// On a project still using the legacy HS256 symmetric secret, getClaims
// falls back to exactly that remote call, so this is correct either way —
// it just isn't fast until the project rotates to asymmetric signing keys.
//
// The tradeoff local verification makes is the usual JWT one: a session
// revoked mid-lifetime stays valid until its access token expires.
export const getCurrentUserId = async (): Promise<string> => {
  const start = performance.now();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub ?? null;
  perfLog("getCurrentUserId", performance.now() - start, {
    hasUser: !!userId,
  });
  if (userId) return userId;

  const mockId = getMockUserId();
  if (mockId) return mockId;

  throw new UnauthorizedError();
};

export const getCurrentUserIdFromRequest = async (
  request: Request,
): Promise<string> => {
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
    const { data } = await supabase.auth.getClaims(token);
    if (data?.claims.sub) return data.claims.sub;
  }

  // No MOCK_USER_ID fallback here: middleware already 401s every /api/*
  // request without a Bearer or cookie session, so this branch was
  // unreachable — and would silently grant access to the configured user
  // if middleware ever stopped guarding API routes.
  throw new UnauthorizedError();
};
