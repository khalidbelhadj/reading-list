// Streams a PDF through our origin so the viewer's <iframe> can use the
// browser's native PDF renderer without CORS/frame-blocking issues. Scoped
// hard: the caller must own an item whose URL resolves to this PDF — this is
// NOT a general-purpose proxy.
import { and, eq } from "drizzle-orm";

import { withUser } from "@/db";
import { items } from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { getPdfUrl } from "@/lib/extract/classify";
import { safeFetch } from "@/lib/url.server";

const MAX_PDF_BYTES = 60 * 1024 * 1024;

export async function servePdf(request: Request): Promise<Response> {
  const itemId = new URL(request.url).searchParams.get("item");
  if (!itemId) return new Response("item is required", { status: 400 });

  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const [item] = await withUser(userId, (tx) =>
    tx
      .select({ url: items.url })
      .from(items)
      .where(and(eq(items.id, itemId), eq(items.userId, userId)))
      .limit(1),
  );
  if (!item) return new Response("Not found", { status: 404 });

  const pdfUrl = getPdfUrl(item.url);
  if (!pdfUrl) return new Response("Item is not a PDF", { status: 415 });

  const upstream = await safeFetch(pdfUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ReadingListViewer/1.0",
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!upstream.ok || !upstream.body) {
    return new Response("Upstream fetch failed", { status: 502 });
  }

  // Don't serve an HTML interstitial (login wall, "file removed" page) at a
  // .pdf URL as though it were a PDF. A missing Content-Type is rejected too:
  // this response is relabelled `application/pdf` on the way out, so anything
  // we can't positively identify must not get that label.
  const upstreamType = upstream.headers.get("content-type") ?? "";
  if (!upstreamType.toLowerCase().includes("pdf")) {
    await upstream.body.cancel();
    return new Response("Upstream is not a PDF", { status: 415 });
  }

  // Advisory only — used to reject an oversized PDF before streaming a single
  // byte. It is NOT forwarded: the cap below can truncate the stream, and a
  // Content-Length that disagrees with the body is a protocol error rather
  // than a clean failure.
  const declaredLength = Number(upstream.headers.get("content-length"));
  const declared = Number.isFinite(declaredLength) ? declaredLength : null;
  if (declared !== null && declared > MAX_PDF_BYTES) {
    await upstream.body.cancel();
    return new Response("PDF too large", { status: 413 });
  }

  // The declared length is advisory (absent on chunked responses, and a
  // hostile origin can lie), so enforce the cap on the bytes as they flow:
  // count each chunk and abort the stream once it exceeds the limit.
  let streamed = 0;
  const capped = upstream.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        streamed += chunk.byteLength;
        if (streamed > MAX_PDF_BYTES) {
          controller.error(new Error("PDF exceeded size cap"));
          return;
        }
        controller.enqueue(chunk);
      },
    }),
  );

  return new Response(capped, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      // These bytes come from a third-party origin and are served from ours,
      // so pin the browser to the declared type instead of letting it sniff.
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
