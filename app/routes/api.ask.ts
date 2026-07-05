import { createFileRoute } from "@tanstack/react-router";

// Agentic "Ask" search endpoint. The handler impl is dynamically imported so the
// AI SDK + db code stay out of every other bundle. Auth + CORS run in the global
// request middleware; the handler resolves the user via the cookie session.
export const Route = createFileRoute("/api/ask")({
  server: {
    handlers: {
      POST: ({ request }) =>
        import("@/app/api/ask/server").then((m) => m.POST(request)),
    },
  },
});
