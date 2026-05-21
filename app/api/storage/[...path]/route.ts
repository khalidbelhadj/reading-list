import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_BUCKETS = new Set(["note-images"]);
const SIGNED_URL_TTL_SECONDS = 60 * 15;
const BROWSER_CACHE_SECONDS = 60 * 10;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  if (!path || path.length < 2) {
    return new NextResponse("Bad path", { status: 400 });
  }

  // Block any traversal/empty segments before we ever touch Supabase.
  if (path.some((segment) => !segment || segment.includes(".."))) {
    return new NextResponse("Bad path", { status: 400 });
  }

  const [bucket, ...keyParts] = path;
  if (!ALLOWED_BUCKETS.has(bucket)) {
    return new NextResponse("Unknown bucket", { status: 404 });
  }

  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Paths are namespaced by owner — first segment must match the caller.
  if (keyParts[0] !== userId) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const key = keyParts.join("/");
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(key, SIGNED_URL_TTL_SECONDS);
  if (error || !data) {
    return new NextResponse("Not found", { status: 404 });
  }

  return NextResponse.redirect(data.signedUrl, {
    status: 302,
    headers: {
      "Cache-Control": `private, max-age=${BROWSER_CACHE_SECONDS}`,
    },
  });
}
