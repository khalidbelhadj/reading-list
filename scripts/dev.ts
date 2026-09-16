#!/usr/bin/env bun
// The web dev server against a backend: `bun run dev [--env=local|prod]`.
// Everything else on the command line goes to vite (`--port 3001`, …).
import { spawn } from "node:child_process";

import {
  describeBackend,
  environmentFor,
  resolveBackend,
  takeEnvFlag,
} from "./profiles";

const { env, rest } = takeEnvFlag(process.argv.slice(2));
let backend;
try {
  backend = resolveBackend(env);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
console.log(describeBackend(backend));

const child = spawn("bun", ["x", "vite", "dev", ...rest], {
  stdio: "inherit",
  env: environmentFor(backend),
});
child.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
