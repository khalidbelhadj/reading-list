import { createFileRoute } from "@tanstack/react-router";

import { PanelLayout } from "@/components/panel-layout";

export const Route = createFileRoute("/")({
  component: PanelLayout,
});
