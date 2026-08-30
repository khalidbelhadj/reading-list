import { createFileRoute } from "@tanstack/react-router";

import { Foundations } from "@/components/design-board/foundations";

export const Route = createFileRoute("/design/rounds")({
  component: Foundations,
});
