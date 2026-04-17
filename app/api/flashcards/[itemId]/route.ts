import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { withUser } from "@/db";
import { flashcards } from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const userId = await getCurrentUserId();
  const { itemId } = await params;

  const cards = await withUser(userId, (tx) =>
    tx
      .select()
      .from(flashcards)
      .where(
        and(eq(flashcards.itemId, itemId), eq(flashcards.userId, userId)),
      )
      .orderBy(desc(flashcards.createdAt)),
  );

  return NextResponse.json(cards);
}
