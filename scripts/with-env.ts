#!/usr/bin/env bun
// Runs a command with a backend's env loaded: the way every dev command
// picks its Supabase.
//
//   bun scripts/with-env.ts [--env=local|prod] <command> [args…]
//
// `--env` may sit anywhere in the arguments, so `bun run db:push --env=prod`
// works even though bun appends it after the script's own arguments.
import { spawn } from "node:child_process";

import {
  describeBackend,
  environmentFor,
  resolveBackend,
  takeEnvFlag,
} from "./profiles";

const { env, rest } = takeEnvFlag(process.argv.slice(2));
const [command, ...args] = rest;
if (!command) {
  console.error(
    "usage: bun scripts/with-env.ts [--env=local|prod] <command> [args…]",
  );
  process.exit(2);
}

let backend;
try {
  backend = resolveBackend(env);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
console.log(describeBackend(backend));

const child = spawn(command, args, {
  stdio: "inherit",
  env: environmentFor(backend),
});
child.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
