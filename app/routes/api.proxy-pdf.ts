import { createFileRoute } from "@tanstack/react-router";

// Same-origin PDF stream for the in-app viewer's native PDF iframe.
// /api/proxy-pdf?item=<itemId> — ownership-checked, SSRF-guarded.
export const Route = createFileRoute("/api/proxy-pdf")({
  server: {
    handlers: {
      GET: ({ request }) =>
        import("@/app/api/proxy-pdf/server").then((m) => m.servePdf(request)),
    },
  },
});
