import { createFileRoute } from "@tanstack/react-router";

import { PageEmptyState } from "@/components/items-list/page-empty-state";
import { SecondaryPage } from "@/components/items-list/secondary-page";

export const Route = createFileRoute("/settings")({
  component: () => (
    <SecondaryPage current="/settings">
      <PageEmptyState message="App preferences will live here." />
    </SecondaryPage>
  ),
});
