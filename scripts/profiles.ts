// Which backend a dev process talks to, decided once for every shell: the
// web dev server, the Electron window and the Mac app all take the same
// `--env=local|prod` and read the same two files.
//
//   .env.local-stack   the local Supabase stack (bunx supabase start)
//   .env.prod          the hosted project — real data
//
// `local` is the default everywhere; production is always an explicit ask.
// There is no auth bypass: the local stack has one standard dev user
// (`DEV_USER`, created by `bun run db:setup-local`) and every shell signs
// in as it with email and password.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type Backend = "local" | "prod";

/** The local stack's one user. Every shell, script and agent signs in as it. */
export const DEV_USER = {
  email: "dev@reading.local",
  password: "devpassword123",
} as const;

export const BACKENDS: Record<
  Backend,
  { file: string; label: string; api: string }
> = {
  local: {
    file: ".env.local-stack",
    label: "LOCAL",
    api: "http://localhost:3000",
  },
  prod: {
    file: ".env.prod",
    label: "PROD",
    api: "https://reading-list.khalidbelhadj.com",
  },
};

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

export const parseEnvFile = (path: string): Record<string, string> => {
  const values: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    values[trimmed.slice(0, eq).trim()] = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^(["'])(.*)\1$/, "$2");
  }
  return values;
};

export type ResolvedBackend = {
  name: Backend;
  label: string;
  file: string;
  api: string;
  values: Record<string, string>;
  supabaseUrl: string;
};

const isBackend = (name: string): name is Backend => name in BACKENDS;

/** The backend by name; throws with the fix when it is unknown or unset up. */
export const resolveBackend = (name = "local"): ResolvedBackend => {
  const key = name.toLowerCase();
  if (!isBackend(key)) {
    throw new Error(
      `Unknown backend "${name}". Use --env=local or --env=prod.`,
    );
  }
  const backend = BACKENDS[key];
  const file = join(repoRoot, backend.file);
  if (!existsSync(file)) {
    throw new Error(
      `Missing ${backend.file} for --env=${key} (see notes/local-supabase.md).`,
    );
  }
  const values = parseEnvFile(file);
  const supabaseUrl = values.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl || !values.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error(
      `${backend.file} has no NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.`,
    );
  }
  return {
    name: key,
    label: backend.label,
    file: backend.file,
    api: backend.api,
    values,
    supabaseUrl,
  };
};

/**
 * Pulls `--env=<name>` (or `--env <name>`) out of an argument list. Returns
 * the backend name (or undefined) and the remaining arguments.
 */
export const takeEnvFlag = (
  args: string[],
): { env: string | undefined; rest: string[] } => {
  const rest: string[] = [];
  let env: string | undefined;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index] ?? "";
    if (arg.startsWith("--env=")) env = arg.slice("--env=".length);
    else if (arg === "--env") env = args[++index];
    else rest.push(arg);
  }
  return { env, rest };
};

/** One line for the terminal, with the warning production deserves. */
export const describeBackend = (backend: ResolvedBackend) =>
  `backend: ${backend.name} (${backend.supabaseUrl}, api ${backend.api})${backend.name === "prod" ? " — writes hit PRODUCTION data" : ""}`;

/** The process environment with the backend's values on top. */
export const environmentFor = (backend: ResolvedBackend) => ({
  ...process.env,
  ...backend.values,
  RL_BACKEND: backend.name,
});

/**
 * For a script that runs in this process (drizzle-kit's config, db/setup):
 * the backend's values onto process.env, without overriding anything the
 * shell already set. Honours RL_BACKEND from with-env.ts.
 */
export const applyBackend = (
  name = process.env.RL_BACKEND,
): ResolvedBackend => {
  const backend = resolveBackend(name);
  for (const [key, value] of Object.entries(backend.values)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return backend;
};
