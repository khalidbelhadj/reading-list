import { db } from "@/db";
import { items, tags, itemsTags } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: itemId } = await params;
  const body = await request.json();
  const { title, url, faviconUrl, type, starred, tagNames } = body as {
    title?: string;
    url?: string;
    faviconUrl?: string;
    type?: string;
    starred?: boolean;
    tagNames?: string[];
  };

  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    const set: Record<string, unknown> = { updatedAt: now };
    if (title !== undefined) set.title = title;
    if (url !== undefined) set.url = url;
    if (faviconUrl !== undefined) set.faviconUrl = faviconUrl;
    if (type !== undefined) set.type = type;
    if (starred !== undefined) set.starred = starred;

    await tx.update(items).set(set).where(eq(items.id, itemId));

    if (tagNames !== undefined) {
      const existingLinks = await tx
        .select({ tagId: itemsTags.tagId })
        .from(itemsTags)
        .where(eq(itemsTags.itemId, itemId));
      const existingTagIds = existingLinks.map((l) => l.tagId);

      const newTagIds: number[] = [];
      for (const tagName of tagNames) {
        await tx.insert(tags).values({ name: tagName }).onConflictDoNothing();
        const [tag] = await tx.select().from(tags).where(eq(tags.name, tagName));
        if (tag) newTagIds.push(tag.id);
      }

      for (const tagId of existingTagIds) {
        if (!newTagIds.includes(tagId)) {
          await tx.delete(itemsTags).where(
            and(eq(itemsTags.itemId, itemId), eq(itemsTags.tagId, tagId)),
          );
        }
      }

      for (const tagId of newTagIds) {
        if (!existingTagIds.includes(tagId)) {
          await tx.insert(itemsTags).values({ itemId, tagId });
        }
      }
    }
  });

  revalidatePath("/");
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: itemId } = await params;

  await db.delete(itemsTags).where(eq(itemsTags.itemId, itemId));
  await db.delete(items).where(eq(items.id, itemId));

  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
