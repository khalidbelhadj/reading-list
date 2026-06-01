import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";

import { getSettings } from "@/app/actions";
import { PanelLayout } from "@/components/panel-layout";

const Page = async () => {
  // Prefetch settings server-side so density/groupBy/etc are known on the
  // first paint (no skeleton flash, no hydration mismatch).
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PanelLayout />
    </HydrationBoundary>
  );
};

export default Page;
