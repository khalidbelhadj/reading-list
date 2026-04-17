import { useQuery } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";

export const useCurrentUser = () =>
  useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data } = await createClient().auth.getUser();
      return data.user ?? null;
    },
    staleTime: Infinity,
  });
