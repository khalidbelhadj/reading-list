import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/shell/shell";

const Index = () => {
  const { item } = Route.useSearch();
  return <AppShell initialItemId={item} />;
};

export const Route = createFileRoute("/")({
  // Legacy addressing contract: the browser extension (and old deep links)
  // open items as `/?item=<id>`. The shell consumes the param as its initial
  // view; everything else in the shell is in-memory state.
  validateSearch: (search: Record<string, unknown>): { item?: string } => ({
    item: typeof search.item === "string" ? search.item : undefined,
  }),
  component: Index,
});
