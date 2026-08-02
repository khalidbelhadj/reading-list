import { useQuery } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";

// The identity fields the UI actually consumes (see account-menu). Sourced
// from the access token's claims rather than the full Supabase User object.
export type CurrentUser = {
  id: string;
  email: string | null;
  user_metadata: Record<string, unknown>;
};

// getClaims, not getUser: getUser round-trips to /auth/v1/user on every call.
// getClaims verifies the token signature locally and caches the JWKS, so only
// the first call in a session touches the network.
export const useCurrentUser = () =>
  useQuery({
    queryKey: ["current-user"],
    queryFn: async (): Promise<CurrentUser | null> => {
      const { data } = await createClient().auth.getClaims();
      if (!data?.claims.sub) return null;
      return {
        id: data.claims.sub,
        email: data.claims.email ?? null,
        user_metadata: data.claims.user_metadata ?? {},
      };
    },
    staleTime: Infinity,
  });
