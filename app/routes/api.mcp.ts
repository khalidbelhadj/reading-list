import { createFileRoute } from "@tanstack/react-router";

// Remote MCP server (reading list + flashcard CRUD). Auth and CORS run in the
// global request middleware; the handler impl is dynamically imported so the
// MCP SDK and db code stay out of every other bundle.
const handle = ({ request }: { request: Request }) =>
  import("@/app/api/mcp/server").then((m) => m.handleMcpRequest(request));

export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
      DELETE: handle,
    },
  },
});
