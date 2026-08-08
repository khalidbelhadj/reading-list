// Backfill the intelligence layer for one user: enqueue every item without a
// content row, then drain the queue until empty. Respects the same worker
// code paths as the app (claim query, precedence, embeddings).
//
//   NODE_ENV=development bun scripts/backfill-content.ts [userId]
//
// Reads DATABASE_URL / EMBEDDING_PROVIDER from .env.local.
import { config } from "dotenv";
config({ path: ".env.local" });

const userId = process.argv[2] ?? process.env.MOCK_USER_ID;
if (!userId) {
  console.error("Pass a user id or set MOCK_USER_ID in .env.local");
  process.exit(1);
}

const { sql } = await import("drizzle-orm");
const { db } = await import("../db");
const { runPass } = await import("../lib/extract/worker.server");

const enqueued = await db.execute(sql`
  INSERT INTO item_content (item_id, user_id, state, created_at, updated_at)
  SELECT i.id, i.user_id, 'pending', now(), now()
  FROM items i
  WHERE i.user_id = ${userId}
    AND NOT EXISTS (SELECT 1 FROM item_content ic WHERE ic.item_id = i.id)
  RETURNING item_id
`);
console.log(`enqueued ${Array.from(enqueued).length} items for ${userId}`);

let totalOk = 0;
let totalFailed = 0;
for (let batch = 0; batch < 200; batch++) {
  const result = await runPass();
  if (result.indexed + result.failed === 0) break;
  totalOk += result.indexed;
  totalFailed += result.failed;
  console.log(
    `batch ${batch}: indexed=${result.indexed} failed=${result.failed} (total indexed=${totalOk} failed=${totalFailed})`,
  );
}
console.log(`backfill done: ok=${totalOk} failed=${totalFailed}`);
process.exit(0);
