import { MutationCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// One QueryClient per browser session (the router creates a fresh one per
// SSR request via getRouter). Mutation errors surface as toasts; an
// "Unauthorized" error means the Supabase session died mid-action, so bail
// to the login page instead of toasting.
export const makeQueryClient = () => {
  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
      },
    },
    mutationCache: new MutationCache({
      onError: (error) => {
        if (error instanceof Error && error.message === "Unauthorized") {
          window.location.href = "/login";
          return;
        }
        const message =
          error instanceof Error ? error.message : "Something went wrong";
        const [title, ...rest] = message.split(". ");
        const description = rest.join(". ");
        toast.error(
          (title ?? "").replace(/\.$/, ""),
          description ? { description } : undefined,
        );
      },
    }),
  });
  return queryClient;
};
