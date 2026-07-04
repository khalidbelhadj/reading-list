import { createFileRoute, notFound } from "@tanstack/react-router";

import DebugReviewCountAnimationsPage from "@/app/debug/review-count-animations/page";

// Dev-only page: 404s outside development (the guard used to live in the
// Next.js page component).
export const Route = createFileRoute("/debug/review-count-animations")({
  beforeLoad: () => {
    if (process.env.NODE_ENV !== "development") throw notFound();
  },
  component: DebugReviewCountAnimationsPage,
});
