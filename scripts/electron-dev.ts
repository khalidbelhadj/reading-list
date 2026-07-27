#!/usr/bin/env bun
/**
 * One-command Electron dev launcher with automatic port selection.
 *
 * Runs `vite dev` (which auto-picks the next free port when 3000 is taken),
 * reads the port Vite *actually* bound from its stdout, waits for the server to
 * answer, then starts Electron pointed at that exact URL via ELECTRON_DEV_URL.
 *
 * Because electron/main.ts keys its userData dir + single-instance lock off the
 * port, every invocation lands on its own port and therefore its own isolated
 * window — so this command can be run N times (or by N agents) with zero
 * coordination. Set PORT=xxxx to pin a specific port instead of auto-selecting.
 */
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

// Strip ANSI color codes (ESC [ ... m) before matching Vite's URL line.
const stripAnsi = (text: string) => text.replace(/\x1b\[[0-9;]*m/g, "");

// Walk up from cwd to the nearest node_modules/.bin and prepend it to PATH, so
// `vite` resolves whether invoked via `bun run electron:dev` or directly — and
// in git worktrees, where node_modules lives in the main checkout's root rather
// than the worktree.
const findBinDir = () => {
  let dir = process.cwd();
  while (true) {
    const candidate = path.join(dir, "node_modules", ".bin");
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
};

const binDir = findBinDir();
const env = {
  ...process.env,
  PATH: binDir
    ? `${binDir}${path.delimiter}${process.env.PATH ?? ""}`
    : (process.env.PATH ?? ""),
};

// PORT pins a port (--strictPort makes Vite error if it's taken); unset lets
// Vite auto-select starting from the config default (3000).
const requestedPort = process.env.PORT;
const viteArgs = ["dev"];
if (requestedPort) viteArgs.push("--port", requestedPort, "--strictPort");

const devServer = spawn("vite", viteArgs, {
  stdio: ["inherit", "pipe", "inherit"],
  env,
});

let electron: ChildProcess | null = null;
let shuttingDown = false;
let detected = false;

const shutdown = (code: number) => {
  if (shuttingDown) return;
  shuttingDown = true;
  devServer.kill("SIGTERM");
  electron?.kill("SIGTERM");
  process.exit(code);
};

const waitForServer = async (url: string) => {
  // Mirror the old `wait-on` step: hold the window until the dev server answers,
  // otherwise Electron's first paint races the initial compile.
  for (let attempt = 0; attempt < 600; attempt++) {
    try {
      await fetch(url, { method: "HEAD" });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
};

const launchElectron = async (port: string) => {
  const url = `http://localhost:${port}`;
  await waitForServer(url);
  if (shuttingDown) return;
  console.log(`\n[electron-dev] launching Electron -> ${url}\n`);
  electron = spawn("bun", ["run", "electron:start"], {
    stdio: "inherit",
    env: { ...env, ELECTRON_DEV_URL: url },
  });
  electron.on("exit", () => shutdown(0));
};

devServer.stdout?.on("data", (chunk: Buffer) => {
  process.stdout.write(chunk); // keep Vite's colored logs intact
  if (detected) return;
  const match = stripAnsi(chunk.toString()).match(/localhost:(\d+)/);
  const port = match?.[1];
  if (!port) return;
  detected = true;
  void launchElectron(port);
});

devServer.on("exit", (code) => shutdown(code ?? 0));
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
