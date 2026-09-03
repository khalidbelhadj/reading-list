import { createFileRoute } from "@tanstack/react-router";

// Fetch proxy for the index worker (see app/api/fetch/server.ts).
export const Route = createFileRoute("/api/fetch")({
  server: {
    handlers: {
      GET: ({ request }) =>
        import("@/app/api/fetch/server").then((m) => m.GET(request)),
    },
  },
});
