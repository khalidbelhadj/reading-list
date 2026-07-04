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

const sql = postgres(url, { prepare: false });

try {
  await sql.file("db/setup.sql");
  console.log("✓ db/setup.sql applied");
} catch (error) {
  console.error("✗ Failed to apply db/setup.sql:", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
