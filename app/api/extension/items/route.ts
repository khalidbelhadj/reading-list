import { NextRequest, NextResponse } from "next/server";
import { createItem, fetchPageTitle } from "@/app/actions/items";
import { UnauthorizedError, getCurrentUserId } from "@/lib/auth";
import { withUser } from "@/db";
import { items } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { normalizeUrl } from "@/lib/url";

// Lookup endpoint for the Chrome extension popup: given a page url, return the
// matching saved item (or null) so the UI can show "open" instead of "save".
// Items are stored with normalized urls, so we normalize before matching.
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    const userId = await getCurrentUserId();
    const normalized = normalizeUrl(url);
    if (!normalized) return NextResponse.json({ item: null });

    const item = await withUser(userId, async (tx) => {
      const [row] = await tx
        .select({
          id: items.id,
          title: items.title,
          url: items.url,
          faviconUrl: items.faviconUrl,
        })
        .from(items)
        .where(and(eq(items.userId, userId), eq(items.url, normalized)))
        .limit(1);
      return row ?? null;
    });

    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message =
      error instanceof Error ? error.message : "Could not look up item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Save endpoint for the Chrome extension. Auth + CORS are handled by
// middleware.ts (Supabase cookie session or Bearer token). The body mirrors
// a subset of createItem's args; if no title is supplied (e.g. a dragged
// link), the server fetches one from the page.
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    url,
    title,
    faviconUrl,
    allowDuplicateUrl,
  } = (body ?? {}) as {
    url?: unknown;
    title?: unknown;
    faviconUrl?: unknown;
    allowDuplicateUrl?: unknown;
  };

  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
    return NextResponse.json(
      { error: "A valid http(s) url is required" },
      { status: 400 },
    );
  }

  const isHttpUrl = (value: unknown): value is string =>
    typeof value === "string" && /^https?:\/\//i.test(value);

  let resolvedTitle =
    typeof title === "string" && title.trim() ? title.trim() : "";
  if (!resolvedTitle) {
    resolvedTitle = (await fetchPageTitle(url)) ?? url;
  }
  // createItemSchema caps titles at 500 chars.
  resolvedTitle = resolvedTitle.slice(0, 500);

  try {
    const result = await createItem(
      resolvedTitle,
      url,
      [],
      isHttpUrl(faviconUrl) ? faviconUrl : undefined,
      undefined,
      undefined,
      allowDuplicateUrl === true,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message =
      error instanceof Error ? error.message : "Could not save item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
