import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, notExists, sql } from "drizzle-orm";

import * as schema from "../db/schema";
import { itemsTags, tags } from "../db/schema";

config({ path: ".env.local" });

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

const main = async () => {
  const before = await db.select({ count: sql<number>`count(*)::int` }).from(tags);
  console.log(`tags before: ${before[0].count}`);

  const deleted = await db
    .delete(tags)
    .where(
      notExists(
        db
          .select({ one: sql`1` })
          .from(itemsTags)
          .where(eq(itemsTags.tagId, tags.id)),
      ),
    )
    .returning({ id: tags.id, name: tags.name, userId: tags.userId });

  console.log(`deleted ${deleted.length} orphan tag(s)`);
  if (deleted.length > 0) {
    for (const tag of deleted) {
      console.log(`  - id=${tag.id} name=${tag.name} userId=${tag.userId}`);
    }
  }

  const after = await db.select({ count: sql<number>`count(*)::int` }).from(tags);
  console.log(`tags after:  ${after[0].count}`);

  await client.end();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
