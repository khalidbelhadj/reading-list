import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";

import { getSettings } from "@/app/actions";
import { AppRouter } from "@/components/router/app-router";

// Optional catch-all: serves the client SPA shell for every in-app path
// (/, /review, /review/:id, /settings, and any unknown path → SPA 404). More
// specific Next routes (/login, /oauth/*, /auth/*, /api/*, /debug/*) still win,
// so auth and the MCP server are untouched. Middleware auth-gates these paths
// server-side before the shell ever loads.
const Page = async () => {
  // Prefetch settings server-side so density/groupBy/etc. seed the React Query
  // cache at hydration — no skeleton flash once the client router mounts.
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AppRouter />
    </HydrationBoundary>
  );
};

export default Page;
