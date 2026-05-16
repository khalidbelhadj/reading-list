import { config } from "dotenv";
import postgres from "postgres";
import { readFileSync } from "node:fs";

config({ path: ".env.local" });

const file = process.argv[2];
if (!file) {
  console.error("usage: bun run scripts/run-sql.ts <path-to.sql>");
  process.exit(1);
}

const text = readFileSync(file, "utf8");
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

try {
  await sql.unsafe(text);
  console.log(`applied ${file}`);
} finally {
  await sql.end();
}
