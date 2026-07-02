import { createFileRoute, notFound } from "@tanstack/react-router";

import DebugEmptyStatesPage from "@/app/debug/empty-states/page";

// Dev-only page: 404s outside development (the guard used to live in the
// Next.js page component).
export const Route = createFileRoute("/debug/empty-states")({
  beforeLoad: () => {
    if (process.env.NODE_ENV !== "development") throw notFound();
  },
  component: DebugEmptyStatesPage,
});
