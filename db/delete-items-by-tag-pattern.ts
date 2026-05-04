import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { and, eq, inArray, like, sql, notExists } from "drizzle-orm";

import * as schema from "./schema";
import { items, itemsTags, tags, flashcards } from "./schema";

config({ path: ".env.local" });

const tagPattern = process.argv[2];
const apply = process.argv.includes("--apply");

if (!tagPattern) {
  console.error(
    'Usage: bun db/delete-items-by-tag-pattern.ts "<tag-pattern>" [--apply]\n' +
      'Pattern uses SQL LIKE syntax. Example: "product/%" matches "product/foo", "product/bar/baz", etc.\n' +
      "Without --apply this is a dry run; nothing is deleted.",
  );
  process.exit(1);
}

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

const main = async () => {
  console.log(`Mode: ${apply ? "APPLY (will delete)" : "DRY RUN (no changes)"}`);
  console.log(`Tag pattern: ${tagPattern}`);
  console.log();

  const matchedTags = await db
    .select({ id: tags.id, name: tags.name, userId: tags.userId })
    .from(tags)
    .where(like(tags.name, tagPattern));

  if (matchedTags.length === 0) {
    console.log("No tags matched the pattern. Nothing to do.");
    await client.end();
    return;
  }

  console.log(`Matched ${matchedTags.length} tag(s):`);
  for (const t of matchedTags) {
    console.log(`  - id=${t.id} name=${t.name} userId=${t.userId}`);
  }
  console.log();

  const tagIds = matchedTags.map((t) => t.id);
  const itemRows = await db
    .selectDistinct({
      id: items.id,
      title: items.title,
      url: items.url,
      userId: items.userId,
    })
    .from(items)
    .innerJoin(itemsTags, eq(itemsTags.itemId, items.id))
    .where(inArray(itemsTags.tagId, tagIds));

  if (itemRows.length === 0) {
    console.log("No items reference those tags. Nothing to do.");
    await client.end();
    return;
  }

  console.log(`Items that would be deleted: ${itemRows.length}`);
  for (const item of itemRows) {
    console.log(`  - id=${item.id}  title="${item.title}"  url=${item.url}  userId=${item.userId}`);
  }
  console.log();

  const itemIds = itemRows.map((i) => i.id);

  const cardRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(flashcards)
    .where(inArray(flashcards.itemId, itemIds));
  const cardCount = cardRows[0]?.count ?? 0;
  console.log(`Flashcards that would be cascade-deleted: ${cardCount}`);
  console.log();

  if (!apply) {
    console.log("DRY RUN — no changes made. Re-run with --apply to delete.");
    await client.end();
    return;
  }

  // Capture all tag ids on these items so we can prune orphans afterwards.
  const affectedTagIds = (
    await db
      .select({ tagId: itemsTags.tagId })
      .from(itemsTags)
      .where(inArray(itemsTags.itemId, itemIds))
  ).map((r) => r.tagId);

  await db.transaction(async (tx) => {
    await tx.delete(itemsTags).where(inArray(itemsTags.itemId, itemIds));
    await tx.delete(flashcards).where(inArray(flashcards.itemId, itemIds));
    await tx.delete(items).where(inArray(items.id, itemIds));

    const unique = Array.from(new Set(affectedTagIds));
    if (unique.length > 0) {
      await tx
        .delete(tags)
        .where(
          and(
            inArray(tags.id, unique),
            notExists(
              tx
                .select({ one: sql`1` })
                .from(itemsTags)
                .where(eq(itemsTags.tagId, tags.id)),
            ),
          ),
        );
    }
  });

  console.log(`Deleted ${itemRows.length} item(s) and ${cardCount} flashcard(s).`);
  await client.end();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
