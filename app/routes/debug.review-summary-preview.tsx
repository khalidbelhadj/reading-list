import { createFileRoute, notFound } from "@tanstack/react-router";

import DebugReviewSummaryPreviewPage from "@/app/debug/review-summary-preview/page";

// Dev-only page: 404s outside development (the guard used to live in the
// Next.js page component).
export const Route = createFileRoute("/debug/review-summary-preview")({
  beforeLoad: () => {
    if (process.env.NODE_ENV !== "development") throw notFound();
  },
  component: DebugReviewSummaryPreviewPage,
});
