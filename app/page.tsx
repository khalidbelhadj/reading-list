import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { Suspense } from "react";
import { ItemsList } from "@/components/items-list";
import { fetchItems } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Page() {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["items"],
    queryFn: fetchItems,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense>
        <ItemsList />
      </Suspense>
    </HydrationBoundary>
  );
}
