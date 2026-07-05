import { createItem, fetchPageTitle } from "@/app/actions/items";
import { UnauthorizedError, getCurrentUserId } from "@/lib/auth";
import { ActionError } from "@/lib/safe-action";
import { withUser } from "@/db";
import { items } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { normalizeUrl } from "@/lib/url";

// Lookup endpoint for the Chrome extension popup: given a page url, return the
// matching saved item (or null) so the UI can show "open" instead of "save".
// Items are stored with normalized urls, so we normalize before matching.
export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url");
  if (!url) {
    return Response.json({ error: "url is required" }, { status: 400 });
  }

  try {
    const userId = await getCurrentUserId();
    const normalized = normalizeUrl(url);
    if (!normalized) return Response.json({ item: null });

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

    return Response.json({ item });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Surface deliberate, client-safe errors verbatim; genericize the rest so
    // raw Postgres detail never reaches the extension (cf. safeAction).
    if (error instanceof ActionError) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    console.error("[extension:GET /items]", error);
    return Response.json({ error: "Could not look up item" }, { status: 500 });
  }
}

// Save endpoint for the Chrome extension. Auth + CORS are handled by
// middleware.ts (Supabase cookie session or Bearer token). The body mirrors
// a subset of createItem's args; if no title is supplied (e.g. a dragged
// link), the server fetches one from the page.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url, title, faviconUrl, allowDuplicateUrl } = (body ?? {}) as {
    url?: unknown;
    title?: unknown;
    faviconUrl?: unknown;
    allowDuplicateUrl?: unknown;
  };

  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
    return Response.json(
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
    // Echo back the title we resolved (possibly fetched server-side) so the
    // extension can show it in its notification instead of the bare url.
    return Response.json({ ...result, title: resolvedTitle });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Surface deliberate, client-safe errors verbatim; genericize the rest so
    // raw Postgres detail never reaches the extension (cf. safeAction).
    if (error instanceof ActionError) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    console.error("[extension:POST /items]", error);
    return Response.json({ error: "Could not save item" }, { status: 500 });
  }
}
