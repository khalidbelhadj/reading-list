import { NextResponse } from "next/server";

import { getVersionInfo } from "@/lib/version";

// Read fresh on every request so runtime values (region) are accurate and the
// response is never statically cached.
export const dynamic = "force-dynamic";

// This endpoint is unauthenticated (the middleware skips auth for `.json`
// paths), so it must not leak internal detail. Omit `commit.message` — it can
// contain internal notes, customer names, or "fix <sensitive>" wording. The
// dev-only /debug/version page still shows the full info via getVersionInfo().
export const GET = () => {
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
  return NextResponse.json(publicInfo, {
    headers: { "Cache-Control": "no-store" },
  });
};
