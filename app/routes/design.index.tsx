import { createFileRoute } from "@tanstack/react-router";

import { Spec } from "@/components/design-board/spec";

export const Route = createFileRoute("/design/")({
  component: Spec,
});
