import { createFileRoute } from "@tanstack/react-router";

import { PageEmptyState } from "@/components/items-list/page-empty-state";
import { SecondaryPage } from "@/components/items-list/secondary-page";

export const Route = createFileRoute("/review/")({
  component: () => (
    <SecondaryPage>
      <PageEmptyState message="Your review activity and stats will live here." />
    </SecondaryPage>
  ),
});
