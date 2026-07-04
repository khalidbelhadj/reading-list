import { createFileRoute } from "@tanstack/react-router";

// Chrome extension endpoints: GET looks up a saved item by page url, POST
// saves one. Auth (cookie or Bearer) + CORS are handled by the global request
// middleware.
export const Route = createFileRoute("/api/extension/items")({
  server: {
    handlers: {
      GET: ({ request }) =>
        import("@/app/api/extension/items.server").then((m) => m.GET(request)),
      POST: ({ request }) =>
        import("@/app/api/extension/items.server").then((m) => m.POST(request)),
    },
  },
});
