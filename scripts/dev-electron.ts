#!/usr/bin/env bun
/**
 * Launch an Electron dev window pointed at a specific Supabase backend.
 *
 *   bun run electron:local   # local stack   (.env.localdev)
 *   bun run electron:prod    # hosted/prod   (.env.hosted)
 *
 * The chosen profile's vars are injected into the child process's env rather
 * than written to `.env.local`, so a local window and a prod window can run at
 * the same time without clobbering each other (Next.js lets process.env take
 * precedence over .env.local). Window isolation itself is handled by
 * electron-dev.ts, which keys each window's port/userData/lock independently.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const PROFILES: Record<string, string> = {
  local: ".env.localdev",
  prod: ".env.hosted",
  hosted: ".env.hosted",
};

const target = (process.argv[2] ?? "local").toLowerCase();
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

// Parse the profile's KEY=VALUE lines (supports optional surrounding quotes).
const profileEnv: Record<string, string> = {};
for (const line of readFileSync(profilePath, "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  profileEnv[key] = value;
}

const isProd = !/127\.0\.0\.1|localhost/.test(
  profileEnv.NEXT_PUBLIC_SUPABASE_URL ?? "",
);
console.log(
  `[dev-electron] ${isProd ? "HOSTED (prod)" : "LOCAL"} -> ${profileEnv.NEXT_PUBLIC_SUPABASE_URL ?? "?"}`,
);
if (isProd) console.log("[dev-electron] ⚠️  Writes hit PRODUCTION data.");

const child = spawn("bun", ["scripts/electron-dev.ts"], {
  stdio: "inherit",
  // profileEnv overrides any same-named vars; @next/env then won't overwrite
  // these from .env.local, so the window targets the chosen backend.
  env: { ...process.env, ...profileEnv },
});
child.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
