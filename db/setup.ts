// Applies db/setup.sql — the post-schema DDL (extensions, search indexes,
// row-level security, policies, grants, Realtime sync trigger) that
// `drizzle-kit push` does not manage. Run after `bun run db:push`.
//
//   bun run db:setup
//
// Idempotent and safe to re-run.
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required (set it in .env.local).");
  process.exit(1);
}

// max: 1 — setup.sql contains its own BEGIN/COMMIT, which postgres.js only
// allows on a single-connection client (UNSAFE_TRANSACTION otherwise). onnotice
// swallows the harmless "already exists, skipping" notices from the idempotent
// guards.
const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });

try {
  await sql.file("db/setup.sql");
  console.log("✓ db/setup.sql applied");
} catch (error) {
  console.error("✗ Failed to apply db/setup.sql:", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
