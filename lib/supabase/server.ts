import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import { getRequestHeader, setCookie } from "@tanstack/react-start/server";

// Request-scoped Supabase client for server functions, loaders, and server
// routes. Reads cookies from the incoming request via TanStack Start's
// request context; writes (session refreshes, sign-out) land on the response.
export const createClient = async () => {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () =>
          parseCookieHeader(getRequestHeader("cookie") ?? "").map(
            ({ name, value }) => ({ name, value: value ?? "" }),
          ),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            setCookie(name, value, options),
          );
        },
      },
    },
  );
};
