import { createFileRoute, notFound } from "@tanstack/react-router";

import DebugToastsPage from "@/app/debug/toasts/page";

// Dev-only page: 404s outside development (the guard used to live in the
// Next.js page component).
export const Route = createFileRoute("/debug/toasts")({
  beforeLoad: () => {
    if (process.env.NODE_ENV !== "development") throw notFound();
  },
  component: DebugToastsPage,
});
