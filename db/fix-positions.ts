import { db } from "./index";
import { items } from "./schema";
import { eq, asc, desc } from "drizzle-orm";

async function fixPositions() {
  await db.transaction(async (tx) => {
    for (const type of ["reading-list", "bookmark"]) {
      const rows = await tx
        .select({ id: items.id })
        .from(items)
        .where(eq(items.type, type))
        .orderBy(desc(items.createdAt));

      for (let i = 0; i < rows.length; i++) {
        await tx
          .update(items)
          .set({ position: i })
          .where(eq(items.id, rows[i].id));
      }

      console.log(`${type}: renumbered ${rows.length} items (newest first)`);
    }
  });

  process.exit(0);
}

fixPositions();
