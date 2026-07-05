import { createServerClient } from "@supabase/ssr";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { perfLog } from "@/lib/perf";

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

// Set by middleware.ts after it verified the caller (and stripped any
// client-sent value), so actions/handlers can skip a second auth.getUser()
// HTTP round trip. Must match VERIFIED_USER_HEADER in middleware.ts.
const VERIFIED_USER_HEADER = "x-verified-user-id";

const getMockUserId = (): string | null => {
  if (process.env.NODE_ENV !== "development") return null;
  return process.env.MOCK_USER_ID ?? null;
};

export const getCurrentUserId = async (): Promise<string> => {
  const start = performance.now();
  try {
    const verified = (await headers()).get(VERIFIED_USER_HEADER);
    if (verified) {
      perfLog("getCurrentUserId", performance.now() - start, {
        source: "header",
      });
      return verified;
    }
  } catch {
    // Outside a request context — fall through to the Supabase lookup.
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  perfLog("getCurrentUserId", performance.now() - start, {
    hasUser: !!user,
    source: "getUser",
  });
  if (user) return user.id;

  const mockId = getMockUserId();
  if (mockId) return mockId;

  throw new UnauthorizedError();
};

export const getCurrentUserIdFromRequest = async (
  request: Request,
): Promise<string> => {
  // Middleware guards every /api/* route and stamps the verified id after
  // checking the Bearer token / cookie session — trust it and skip the
  // duplicate getUser() call.
  const verified = request.headers.get(VERIFIED_USER_HEADER);
  if (verified) return verified;

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
    if (user) return user.id;
  }

  // No MOCK_USER_ID fallback here: middleware already 401s every /api/*
  // request without a Bearer or cookie session, so this branch was
  // unreachable — and would silently grant access to the configured user
  // if middleware ever stopped guarding API routes.
  throw new UnauthorizedError();
};
