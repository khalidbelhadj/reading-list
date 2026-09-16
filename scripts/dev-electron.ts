#!/usr/bin/env bun
// An Electron dev window against a backend: `bun run electron [--env=local|prod]`.
//
// The backend's values ride in the child's environment rather than a file,
// so a local window and a production window can run side by side. Window
// isolation itself is electron-dev.ts's job (port, userData and lock are
// keyed per window).
import { spawn } from "node:child_process";
import { join } from "node:path";

import {
  describeBackend,
  environmentFor,
  repoRoot,
  resolveBackend,
  takeEnvFlag,
} from "./profiles";

const { env } = takeEnvFlag(process.argv.slice(2));
let backend;
try {
  backend = resolveBackend(env);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
console.log(describeBackend(backend));

const child = spawn("bun", [join(repoRoot, "scripts/electron-dev.ts")], {
  stdio: "inherit",
  env: environmentFor(backend),
});
child.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
