import { db } from "../db/index";
import { items } from "../db/schema";
import { and, eq, desc } from "drizzle-orm";

async function fixPositions() {
  const userId = process.env.FIX_USER_ID;
  if (!userId) {
    console.error(
      "Set FIX_USER_ID to the Supabase auth.users.id whose positions should be renumbered.",
    );
    process.exit(1);
  }

  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: items.id })
      .from(items)
      .where(eq(items.userId, userId))
      .orderBy(desc(items.createdAt));

    for (let i = 0; i < rows.length; i++) {
      await tx
        .update(items)
        .set({ position: i })
        .where(and(eq(items.id, rows[i].id), eq(items.userId, userId)));
    }

    console.log(`renumbered ${rows.length} items (newest first)`);
  });

  process.exit(0);
}

fixPositions();
