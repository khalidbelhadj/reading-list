import { createFileRoute } from "@tanstack/react-router";

// Authenticated read path for Supabase Storage objects embedded in notes:
// /api/storage/<bucket>/<userId>/<key> → 302 to a short-lived signed URL.
export const Route = createFileRoute("/api/storage/$")({
  server: {
    handlers: {
      GET: ({ params }) =>
        import("@/app/api/storage/server").then((m) =>
          m.serveStorageObject(params._splat?.split("/") ?? []),
        ),
    },
  },
});
