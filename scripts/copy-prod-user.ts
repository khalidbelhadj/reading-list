/**
 * Copy one user's data from the hosted (prod) Supabase into the LOCAL stack,
 * replacing everything the local user currently has.
 *
 *   bun scripts/copy-prod-user.ts                            # defaults + confirm
 *   bun scripts/copy-prod-user.ts <prod-user-id> <local-user-id>
 *
 * Connections:
 *   PROD_DATABASE_URL  — source (falls back to DATABASE_URL from .env.hosted;
 *                        must NOT be localhost). Opened read-only.
 *   LOCAL_DATABASE_URL — target (defaults to the `supabase start` Postgres,
 *                        postgresql://postgres:postgres@localhost:54322/postgres).
 *                        Must be localhost — the script refuses remote targets.
 *
 * Copies: items, tags, items_tags, flashcards, review_sessions, card_reviews,
 * review_events, user_settings. Serial ids (tags, review_events) are re-issued
 * locally; items_tags is remapped through tag names. Storage objects (preview
 * images, PDFs) are NOT copied — those URLs will still point at prod.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const DEFAULT_PROD_USER_ID = "a543abcc-57d8-4b8e-acc5-9f2e3d4c9e8b";
const DEFAULT_LOCAL_USER_ID = "b1c05586-f82b-4caf-acd9-9fc1155b7456";

const isLocalUrl = (url: string): boolean =>
  /@(localhost|127\.0\.0\.1)[:/]/.test(url);

const confirmDefaults = async (): Promise<[string, string]> => {
  console.log("No user ids given — using the defaults:");
  console.log(`  prod (source): ${DEFAULT_PROD_USER_ID}`);
  console.log(`  local (WIPED): ${DEFAULT_LOCAL_USER_ID}`);
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await readline.question("Continue? [y/N] ");
  readline.close();
  if (!/^y(es)?$/i.test(answer.trim())) {
    console.log("Aborted.");
    process.exit(0);
  }
  return [DEFAULT_PROD_USER_ID, DEFAULT_LOCAL_USER_ID];
};

const args = process.argv.slice(2);
if (args.length !== 0 && args.length !== 2) {
  console.error(
    "Usage: bun scripts/copy-prod-user.ts [<prod-user-id> <local-user-id>]",
  );
  process.exit(1);
}
const [prodUserId, localUserId] =
  args.length === 2 ? (args as [string, string]) : await confirmDefaults();

// Prefer the explicit env var; otherwise pull the hosted URL straight from
// .env.hosted so the script runs with no setup. The shell's DATABASE_URL is
// deliberately ignored — it typically points at the local stack.
const readHostedUrl = (): string | undefined => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const file = join(root, ".env.hosted");
  if (!existsSync(file)) return undefined;
  const line = readFileSync(file, "utf8")
    .split("\n")
    .find((l) => l.startsWith("DATABASE_URL="));
  return line?.slice("DATABASE_URL=".length).trim().replace(/^"|"$/g, "");
};

const prodUrl = process.env.PROD_DATABASE_URL ?? readHostedUrl();
if (!prodUrl || isLocalUrl(prodUrl)) {
  console.error(
    "Source must be the hosted DB: set PROD_DATABASE_URL, or put the Supabase pooler URL in .env.hosted as DATABASE_URL.",
  );
  process.exit(1);
}

const localUrl =
  process.env.LOCAL_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:54322/postgres";
if (!isLocalUrl(localUrl)) {
  console.error(
    `Refusing to write to a non-local target: ${localUrl}\nThis script only replaces data in a local Supabase stack.`,
  );
  process.exit(1);
}

// default_transaction_read_only makes accidental writes to prod a hard error.
const prod = postgres(prodUrl, {
  prepare: false,
  connection: { default_transaction_read_only: true },
});
const local = postgres(localUrl, { prepare: false });

type Row = Record<string, unknown>;

// Prod has drifted from db/schema.ts (e.g. items.position exists only in
// prod), so keep just the columns the local table actually has and report
// what got dropped.
const localColumns = async (table: string): Promise<Set<string>> => {
  const rows = await local<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}`;
  return new Set(rows.map((row) => row.column_name));
};

const fitToLocal = async (table: string, rows: Row[]): Promise<Row[]> => {
  if (rows.length === 0) return rows;
  const columns = await localColumns(table);
  const dropped = Object.keys(rows[0]!).filter((key) => !columns.has(key));
  if (dropped.length > 0) {
    console.log(
      `  note: ${table}: dropping prod-only column(s) ${dropped.join(", ")}`,
    );
  }
  return rows.map((row) =>
    Object.fromEntries(Object.entries(row).filter(([key]) => columns.has(key))),
  );
};

// postgres.js turns JS arrays into PG arrays, which fails on jsonb columns —
// pre-stringify jsonb values so they arrive as json text instead.
const jsonify = (rows: Row[], columns: string[]): Row[] =>
  rows.map((row) => {
    const copy = { ...row };
    for (const column of columns) {
      if (copy[column] !== null && copy[column] !== undefined) {
        copy[column] = JSON.stringify(copy[column]);
      }
    }
    return copy;
  });

const reassign = (rows: Row[]): Row[] =>
  rows.map((row) => ({ ...row, user_id: localUserId }));

const chunked = async (
  rows: Row[],
  insert: (chunk: Row[]) => Promise<unknown>,
): Promise<void> => {
  for (let i = 0; i < rows.length; i += 500) {
    await insert(rows.slice(i, i + 500));
  }
};

const main = async () => {
  console.log(`Reading prod data for user ${prodUserId}…`);

  const [
    items,
    tags,
    itemsTags,
    flashcards,
    reviewSessions,
    cardReviews,
    reviewEvents,
    userSettings,
  ] = await Promise.all([
    prod`SELECT * FROM items WHERE user_id = ${prodUserId}`,
    prod`SELECT * FROM tags WHERE user_id = ${prodUserId}`,
    prod`SELECT it.* FROM items_tags it
         JOIN items i ON i.id = it.item_id
         WHERE i.user_id = ${prodUserId}`,
    prod`SELECT * FROM flashcards WHERE user_id = ${prodUserId}`,
    prod`SELECT * FROM review_sessions WHERE user_id = ${prodUserId}`,
    prod`SELECT * FROM card_reviews WHERE user_id = ${prodUserId}`,
    prod`SELECT * FROM review_events WHERE user_id = ${prodUserId}`,
    prod`SELECT * FROM user_settings WHERE user_id = ${prodUserId}`,
  ]);

  console.log(
    `  ${items.length} items, ${tags.length} tags, ${itemsTags.length} item-tag links,`,
  );
  console.log(
    `  ${flashcards.length} flashcards, ${reviewSessions.length} review sessions, ${cardReviews.length} card reviews,`,
  );
  console.log(
    `  ${reviewEvents.length} review events, ${userSettings.length} settings row(s)`,
  );

  if (items.length === 0 && tags.length === 0 && flashcards.length === 0) {
    console.error(
      "Prod user has no data — aborting instead of wiping the local user.",
    );
    process.exit(1);
  }

  const fittedItems = await fitToLocal("items", reassign(items));
  const fittedFlashcards = await fitToLocal("flashcards", reassign(flashcards));
  const fittedSessions = await fitToLocal(
    "review_sessions",
    jsonify(reassign(reviewSessions), ["scope", "card_ids"]),
  );
  const fittedCardReviews = await fitToLocal(
    "card_reviews",
    reassign(cardReviews),
  );
  // review_events.id is bigserial: drop the prod ids and let local re-issue.
  const fittedEvents = await fitToLocal(
    "review_events",
    jsonify(reassign(reviewEvents), ["data"]).map(
      ({ id: _id, ...rest }) => rest,
    ),
  );
  const fittedSettings = await fitToLocal(
    "user_settings",
    jsonify(reassign(userSettings), ["data"]),
  );

  console.log(`\nReplacing local data for user ${localUserId}…`);

  await local.begin(async (tx) => {
    // Delete children before parents (card_reviews/review_events reference
    // review_sessions without ON DELETE CASCADE); items cascades items_tags.
    await tx`DELETE FROM review_events WHERE user_id = ${localUserId}`;
    await tx`DELETE FROM card_reviews WHERE user_id = ${localUserId}`;
    await tx`DELETE FROM review_sessions WHERE user_id = ${localUserId}`;
    await tx`DELETE FROM flashcards WHERE user_id = ${localUserId}`;
    await tx`DELETE FROM items WHERE user_id = ${localUserId}`;
    await tx`DELETE FROM tags WHERE user_id = ${localUserId}`;
    await tx`DELETE FROM user_settings WHERE user_id = ${localUserId}`;

    await chunked(fittedItems, (chunk) => tx`INSERT INTO items ${tx(chunk)}`);

    // tags.id is serial: insert without ids, then remap items_tags through
    // the (unique per user) tag name.
    const tagIdByName = new Map<string, number>();
    for (const tag of tags) {
      const [inserted] = await tx<{ id: number }[]>`
        INSERT INTO tags (user_id, name)
        VALUES (${localUserId}, ${tag.name as string})
        RETURNING id`;
      tagIdByName.set(tag.name as string, inserted!.id);
    }
    const prodTagNameById = new Map<number, string>(
      tags.map((tag) => [tag.id as number, tag.name as string]),
    );
    const remappedItemsTags = itemsTags.map((link) => ({
      item_id: link.item_id,
      tag_id: tagIdByName.get(prodTagNameById.get(link.tag_id as number)!)!,
    }));
    await chunked(
      remappedItemsTags,
      (chunk) => tx`INSERT INTO items_tags ${tx(chunk)}`,
    );

    await chunked(
      fittedFlashcards,
      (chunk) => tx`INSERT INTO flashcards ${tx(chunk)}`,
    );
    await chunked(
      fittedSessions,
      (chunk) => tx`INSERT INTO review_sessions ${tx(chunk)}`,
    );
    await chunked(
      fittedCardReviews,
      (chunk) => tx`INSERT INTO card_reviews ${tx(chunk)}`,
    );
    await chunked(
      fittedEvents,
      (chunk) => tx`INSERT INTO review_events ${tx(chunk)}`,
    );
    await chunked(
      fittedSettings,
      (chunk) => tx`INSERT INTO user_settings ${tx(chunk)}`,
    );
  });

  console.log("Done. Local user's data now mirrors the prod user.");
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all([prod.end(), local.end()]);
  });
