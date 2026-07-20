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
  const declared = Number(upstream.headers.get("content-length") ?? 0);
  if (declared > MAX_PDF_BYTES) {
    await upstream.body.cancel();
    return new Response("PDF too large", { status: 413 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=3600",
      ...(declared ? { "Content-Length": String(declared) } : {}),
    },
  });
}
