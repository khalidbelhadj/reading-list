/**
 * Switch which Supabase the app connects to by copying a profile file over
 * `.env.local` (which Next.js, drizzle.config.ts, and db/seed.ts all read).
 *
 *   bun run env:local   # → local stack   (.env.localdev)
 *   bun run env:prod    # → hosted/prod   (.env.hosted)
 *   bun run scripts/use-supabase.ts        # show the current target
 *
 * Restart `bun dev` after switching — env is read at process start.
 */
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_LOCAL = join(root, ".env.local");

const PROFILES: Record<string, string> = {
  local: ".env.localdev",
  prod: ".env.hosted",
  hosted: ".env.hosted",
};

const readSupabaseUrl = (file: string): string | null => {
  if (!existsSync(file)) return null;
  const line = readFileSync(file, "utf8")
    .split("\n")
    .find((l) => l.startsWith("NEXT_PUBLIC_SUPABASE_URL="));
  return line ? line.slice("NEXT_PUBLIC_SUPABASE_URL=".length).trim() : null;
};

const describe = (url: string | null): string => {
  if (!url) return "unknown";
  return url.includes("127.0.0.1") || url.includes("localhost")
    ? "LOCAL"
    : "HOSTED (prod)";
};

const target = process.argv[2]?.toLowerCase();

if (!target) {
  const current = readSupabaseUrl(ENV_LOCAL);
  console.log(`Current: ${describe(current)}  ${current ?? "(no .env.local)"}`);
  console.log("\nSwitch with:  bun run env:local  |  bun run env:prod");
  process.exit(0);
}

const profile = PROFILES[target];
if (!profile) {
  console.error(`Unknown target "${target}". Use "local" or "prod".`);
  process.exit(1);
}

const profilePath = join(root, profile);
if (!existsSync(profilePath)) {
  console.error(
    `Missing profile file ${profile}. Create it (see notes/local-supabase.md).`,
  );
  process.exit(1);
}

copyFileSync(profilePath, ENV_LOCAL);
const url = readSupabaseUrl(ENV_LOCAL);
console.log(`Now connecting to: ${describe(url)}  ${url ?? ""}`);
if (describe(url).startsWith("HOSTED")) {
  console.log("⚠️  Writes now hit PRODUCTION data.");
}
console.log("Restart `bun dev` to pick up the change.");
