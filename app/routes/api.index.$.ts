import { createFileRoute } from "@tanstack/react-router";

// The index worker's storage API (jobs, content, failure, embeddings). The
// handler impl is dynamically imported so db code stays out of every other
// bundle; auth runs in the request guard.
export const Route = createFileRoute("/api/index/$")({
  server: {
    handlers: {
      POST: ({ request }) =>
        import("@/app/api/index/server").then((m) => m.POST(request)),
    },
  },
});
