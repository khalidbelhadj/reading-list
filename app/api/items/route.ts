import { db } from "@/db";
import { items, tags, itemsTags } from "@/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const allItems = await db.query.items.findMany({
    orderBy: [asc(items.position)],
    with: { itemsTags: { with: { tag: true } } },
  });

  const data = allItems.map(({ itemsTags, ...item }) => ({
    ...item,
    tags: itemsTags.map((it) => it.tag),
  }));

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { title, url, faviconUrl, type, tags: tagNames } = body as {
    title: string;
    url: string;
    faviconUrl?: string;
    type?: string;
    tags?: string[];
  };

  if (!title || !url) {
    return NextResponse.json({ error: "title and url required" }, { status: 400 });
  }

  const itemId = crypto.randomUUID();
  const now = new Date().toISOString();

  const itemType = type ?? "bookmark";

  await db.transaction(async (tx) => {
    await tx.update(items)
      .set({ position: sql`${items.position} + 1` })
      .where(eq(items.type, itemType));

    await tx.insert(items).values({
      id: itemId,
      title,
      url,
      faviconUrl: faviconUrl ?? null,
      type: itemType,
      starred: false,
      position: 0,
      createdAt: now,
      updatedAt: now,
    });

    if (tagNames) {
      for (const tagName of tagNames) {
        await tx.insert(tags).values({ name: tagName }).onConflictDoNothing();
        const [tag] = await tx.select().from(tags).where(eq(tags.name, tagName));
        if (tag) {
          await tx.insert(itemsTags).values({ itemId, tagId: tag.id });
        }
      }
    }
  });

  revalidatePath("/");
  return NextResponse.json({ id: itemId }, { status: 201 });
}
