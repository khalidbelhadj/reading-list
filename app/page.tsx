import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { fetchItems } from "@/lib/queries";
import { getReviewStatus } from "@/app/actions";
import { ItemsList } from "@/components/items-list";

const Page = async () => {
  const queryClient = new QueryClient();
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["items"],
      queryFn: fetchItems,
    }),
    queryClient.prefetchQuery({
      queryKey: ["review-status"],
      queryFn: getReviewStatus,
    }),
  ]);
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ItemsList />
    </HydrationBoundary>
  );
};

export default Page;
