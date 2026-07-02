import { createFileRoute, notFound } from "@tanstack/react-router";

import DebugReviewDialogsPage from "@/app/debug/review-dialogs/page";

// Dev-only page: 404s outside development (the guard used to live in the
// Next.js page component).
export const Route = createFileRoute("/debug/review-dialogs")({
  beforeLoad: () => {
    if (process.env.NODE_ENV !== "development") throw notFound();
  },
  component: DebugReviewDialogsPage,
});
