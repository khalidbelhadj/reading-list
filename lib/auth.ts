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

export const getCurrentUserId = async (): Promise<string> => {
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
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    if (user) return user.id;
  }

  const mockId = getMockUserId();
  if (mockId) return mockId;

  throw new UnauthorizedError();
};
