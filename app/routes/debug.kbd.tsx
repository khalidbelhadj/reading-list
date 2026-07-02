import { createFileRoute, notFound } from "@tanstack/react-router";

import { NotFound } from "@/components/not-found";

import DebugKbdPage from "@/app/debug/kbd/page";

// Dev-only page: 404s outside development (the guard used to live in the
// Next.js page component).
export const Route = createFileRoute("/debug/kbd")({
  beforeLoad: () => {
    if (process.env.NODE_ENV !== "development") throw notFound();
  },
  notFoundComponent: NotFound,
  component: DebugKbdPage,
});
