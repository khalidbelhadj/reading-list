import { createFileRoute, notFound } from "@tanstack/react-router";

import { NotFound } from "@/components/not-found";

// Dev-only: throws on render to preview the root error boundary.
const DevErrorPage = () => {
  throw new Error("Synthetic error for previewing the route error boundary");
};

export const Route = createFileRoute("/dev-error")({
  beforeLoad: () => {
    if (process.env.NODE_ENV !== "development") throw notFound();
  },
  notFoundComponent: NotFound,
  component: DevErrorPage,
});
