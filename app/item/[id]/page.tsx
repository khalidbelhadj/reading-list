import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { fetchItems } from "@/lib/queries";
import { ItemPage } from "@/components/item-page";

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["items"],
    queryFn: fetchItems,
  });
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ItemPage itemId={id} />
    </HydrationBoundary>
  );
};

export default Page;
