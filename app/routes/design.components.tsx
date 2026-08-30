import { createFileRoute } from "@tanstack/react-router";

import { ComponentsPage } from "@/components/design-board/components-page";

export const Route = createFileRoute("/design/components")({
  component: ComponentsPage,
});
