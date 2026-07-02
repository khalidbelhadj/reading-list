import { createFileRoute, notFound } from "@tanstack/react-router";

import DebugSuggestedCardsPage from "@/app/debug/suggested-cards/page";

// Dev-only page: 404s outside development (the guard used to live in the
// Next.js page component).
export const Route = createFileRoute("/debug/suggested-cards")({
  beforeLoad: () => {
    if (process.env.NODE_ENV !== "development") throw notFound();
  },
  component: DebugSuggestedCardsPage,
});
