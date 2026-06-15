import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@/lib/supabase/server";
import { perfLog } from "@/lib/perf";

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

// Wrapped in React cache() so that if a single server request resolves the
// user more than once (e.g. an RSC render that fetches several things), the
// auth-server round-trip in getUser() runs only once. NOTE: this does NOT
// dedupe across separate server-action POSTs or across middleware → action —
// those are distinct request contexts. getUser() still validates the token
// server-side, so the security properties are unchanged.
export const getCurrentUserId = cache(async (): Promise<string> => {
  const start = performance.now();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  perfLog("getCurrentUserId", performance.now() - start, {
    hasUser: !!user,
  });
  if (user) return user.id;

  const mockId = getMockUserId();
  if (mockId) return mockId;

  throw new UnauthorizedError();
});

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
