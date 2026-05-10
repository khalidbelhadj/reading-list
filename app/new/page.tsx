import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { fetchItems } from "@/lib/queries";
import { NewItemPage } from "@/components/new-item-page";

const Page = async () => {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["items"],
    queryFn: fetchItems,
  });
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <NewItemPage />
    </HydrationBoundary>
  );
};

export default Page;
