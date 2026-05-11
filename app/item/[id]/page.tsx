import { ItemPage } from "@/components/item-page";

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return <ItemPage itemId={id} />;
};

export default Page;
