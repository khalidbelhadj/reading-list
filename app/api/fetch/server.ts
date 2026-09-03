// A fetch proxy for the client worker: browsers can't read arbitrary sites
// (CORS), so the worker asks the server for the bytes. Same SSRF guard as
// every other outbound fetch, a size cap, and the upstream content type
// passed through so the worker can tell HTML from PDF.
import { readCapped, safeFetch } from "@/lib/url.server";

const MAX_BYTES = 25 * 1024 * 1024;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export async function GET(request: Request) {
  const target = new URL(request.url).searchParams.get("url") ?? "";
  if (!/^https?:\/\//i.test(target)) {
    return Response.json(
      { error: "A valid http(s) url is required" },
      { status: 400 },
    );
  }
  let upstream: Response;
  try {
    upstream = await safeFetch(target, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/pdf,*/*",
      },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fetch failed";
    // The guard's refusals are permanent properties of the link; the worker
    // treats 422 as unsupported and anything else as transient.
    const permanent =
      /Blocked hostname|Private IP|Could not resolve|Invalid scheme/.test(
        message,
      );
    return Response.json({ error: message }, { status: permanent ? 422 : 502 });
  }
  if (!upstream.ok) {
    await upstream.body?.cancel();
    return Response.json(
      { error: `HTTP ${upstream.status}` },
      { status: upstream.status },
    );
  }
  const bytes = await readCapped(upstream, MAX_BYTES);
  if (!bytes) {
    return Response.json({ error: "Response too large" }, { status: 413 });
  }
  const body = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return new Response(body, {
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") ?? "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Final-Url": upstream.url || target,
    },
  });
}
