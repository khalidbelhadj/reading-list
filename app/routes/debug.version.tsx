import { createFileRoute, notFound } from "@tanstack/react-router";

import DebugVersionPage from "@/app/debug/version/page";

// Dev-only page: 404s outside development (the guard used to live in the
// Next.js page component).
export const Route = createFileRoute("/debug/version")({
  beforeLoad: () => {
    if (process.env.NODE_ENV !== "development") throw notFound();
  },
  component: DebugVersionPage,
});
