import { getCurrentUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_BUCKETS = new Set(["note-images"]);
const SIGNED_URL_TTL_SECONDS = 60 * 15;
const BROWSER_CACHE_SECONDS = 60 * 10;

// Served by the /api/storage/$ splat route. `path` is the URL path after
// /api/storage/, split on "/": [bucket, userId, ...key].
export async function serveStorageObject(path: string[]): Promise<Response> {
  if (!path || path.length < 2) {
    return new Response("Bad path", { status: 400 });
  }

  // Block any traversal/empty segments before we ever touch Supabase.
  if (path.some((segment) => !segment || segment.includes(".."))) {
    return new Response("Bad path", { status: 400 });
  }

  const [bucket, ...keyParts] = path;
  if (bucket === undefined || !ALLOWED_BUCKETS.has(bucket)) {
    return new Response("Unknown bucket", { status: 404 });
  }

  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  // Paths are namespaced by owner — first segment must match the caller.
  if (keyParts[0] !== userId) {
    return new Response("Forbidden", { status: 403 });
  }

  const key = keyParts.join("/");
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(key, SIGNED_URL_TTL_SECONDS);
  if (error || !data) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: data.signedUrl,
      "Cache-Control": `private, max-age=${BROWSER_CACHE_SECONDS}`,
    },
  });
}
