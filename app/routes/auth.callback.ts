import { createFileRoute } from "@tanstack/react-router";

// Google OAuth code-exchange callback (web + Electron flows).
export const Route = createFileRoute("/auth/callback")({
  server: {
    handlers: {
      GET: ({ request }) =>
        import("@/app/auth/callback.server").then((m) =>
          m.handleAuthCallback(request),
        ),
    },
  },
});
