import { db } from "@/db";
import { items, itemsTags, tags } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "url parameter required" }, { status: 400 });
  }

  const [item] = await db
    .select()
    .from(items)
    .where(eq(items.url, url))
    .limit(1);

  if (!item) {
    return NextResponse.json({ found: false });
  }

  const itemTagLinks = await db
    .select({ name: tags.name, id: tags.id })
    .from(itemsTags)
    .innerJoin(tags, eq(itemsTags.tagId, tags.id))
    .where(eq(itemsTags.itemId, item.id));

  return NextResponse.json({
    found: true,
    item: {
      id: item.id,
      title: item.title,
      url: item.url,
      faviconUrl: item.faviconUrl,
      starred: item.starred,
      tags: itemTagLinks,
    },
  });
}
