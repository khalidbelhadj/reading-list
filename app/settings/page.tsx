import { PageEmptyState } from "@/components/items-list/page-empty-state";
import { SecondaryPage } from "@/components/items-list/secondary-page";

const SettingsPage = () => (
  <SecondaryPage>
    <PageEmptyState message="App preferences will live here." />
  </SecondaryPage>
);

export default SettingsPage;
