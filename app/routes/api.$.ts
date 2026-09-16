import { createFileRoute } from "@tanstack/react-router";

// Every route of lib/api/contract.ts, dispatched by method and path. Auth
// (cookie session or Bearer token) and CORS are handled by the global
// request middleware; the more specific /api/* route files (mcp, extension,
// index, storage, ask, fetch) keep matching before this catch-all.
const dispatch = ({ request }: { request: Request }) =>
  import("@/app/api/dispatch.server").then((m) => m.dispatch(request));

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      GET: dispatch,
      POST: dispatch,
      PATCH: dispatch,
      DELETE: dispatch,
    },
  },
});
