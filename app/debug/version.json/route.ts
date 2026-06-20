import { NextResponse } from "next/server";

import { getVersionInfo } from "@/lib/version";

// Read fresh on every request so runtime values (region) are accurate and the
// response is never statically cached.
export const dynamic = "force-dynamic";

export const GET = () =>
  NextResponse.json(getVersionInfo(), {
    headers: { "Cache-Control": "no-store" },
  });
