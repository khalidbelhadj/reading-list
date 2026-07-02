import { createFileRoute } from "@tanstack/react-router";

// OAuth 2.0 Protected Resource Metadata (RFC 9728): tells MCP clients that
// Supabase is the authorization server for this resource. Unauthenticated by
// design — the request middleware skips auth for /.well-known paths.
export const Route = createFileRoute("/.well-known/oauth-protected-resource")({
  server: {
    handlers: {
      GET: () =>
        Response.json({
          resource:
            process.env.NEXT_PUBLIC_APP_URL ||
            "https://reading-list.khalidbelhadj.com",
          authorization_servers: [
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`,
          ],
        }),
    },
  },
});
