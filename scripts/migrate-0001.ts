/**
 * Applies drizzle/0001_per_user_isolation.sql via postgres.js (no psql needed).
 *
 * Usage:
 *   BACKFILL_USER_ID=<uuid> bun db/migrate-0001.ts
 *
 * The UUID is validated against a strict regex before substitution to avoid
 * any chance of SQL injection through the env var.
 */

import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

config({ path: ".env.local" });

const userId = process.env.BACKFILL_USER_ID;
if (!userId) {
  console.error("Set BACKFILL_USER_ID to the Supabase auth.users.id to backfill under.");
  process.exit(1);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID_RE.test(userId)) {
  console.error(`BACKFILL_USER_ID is not a valid UUID: ${userId}`);
  process.exit(1);
}

const sqlPath = resolve(process.cwd(), "drizzle/0001_per_user_isolation.sql");
const raw = readFileSync(sqlPath, "utf8");

// Substitute the psql variable with a quoted UUID literal. The regex above
// guarantees this can only be hex + dashes, so literal embedding is safe.
const substituted = raw.replace(/:backfill_user_id/g, `'${userId}'`);

// max: 1 is required for `client.unsafe` to run a script containing its own
// BEGIN/COMMIT — otherwise postgres.js refuses with UNSAFE_TRANSACTION.
const client = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

try {
  // The SQL file already wraps everything in BEGIN/COMMIT. `client.unsafe`
  // sends the whole blob as a single simple-query message, so the explicit
  // transaction block inside is respected.
  await client.unsafe(substituted);
  console.log("Migration 0001_per_user_isolation applied successfully.");
} catch (err) {
  console.error("Migration failed:", err);
  process.exit(1);
} finally {
  await client.end();
}
