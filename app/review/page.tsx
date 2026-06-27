import { PageEmptyState } from "@/components/items-list/page-empty-state";
import { SecondaryPage } from "@/components/items-list/secondary-page";

const ReviewPage = () => (
  <SecondaryPage>
    <PageEmptyState message="Your review activity and stats will live here." />
  </SecondaryPage>
);

export default ReviewPage;
