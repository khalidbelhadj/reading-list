import { createFileRoute } from "@tanstack/react-router";

// Read fresh on every request so runtime values (region) are accurate and the
// response is never statically cached.
//
// This endpoint is unauthenticated (the request middleware skips auth for
// `.json` paths), so it must not leak internal detail. Omit `commit.message`
// — it can contain internal notes, customer names, or "fix <sensitive>"
// wording. The dev-only /debug/version page still shows the full info via
// getVersionInfo().
export const Route = createFileRoute("/debug/version.json")({
  server: {
    handlers: {
      GET: async () => {
        const { getVersionInfo } = await import("@/lib/version");
        const info = getVersionInfo();
        const publicInfo = {
          ...info,
          commit: {
            sha: info.commit.sha,
            shortSha: info.commit.shortSha,
            branch: info.commit.branch,
            url: info.commit.url,
          },
        };
        return Response.json(publicInfo, {
          headers: { "Cache-Control": "no-store" },
        });
      },
    },
  },
});
