import { createServerClient } from "@supabase/ssr";

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export const getCurrentUserId = async (): Promise<string> => {
  // TODO: remove hardcoded bypass
  return "a543abcc-57d8-4b8e-acc5-9f2e3d4c9e8b";
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
  return getCurrentUserId();
};
