#!/usr/bin/env bun
/**
 * Build, run and drive the native macOS app (mac/) from the terminal — the
 * SwiftUI counterpart of scripts/electron-cdp.ts.
 *
 * Debug builds of the app open a control socket on 127.0.0.1:9400
 * (mac/Sources/ReadingList/Debug); this script is its client plus the build
 * and launch plumbing around it. Screenshots go through `screencapture -l`,
 * which captures the window exactly as the window server composites it,
 * Liquid Glass included.
 *
 *   bun run mac run                      # build, (re)launch, wait until it answers
 *   bun run mac screenshot               # 1x PNG of the window (pixels = points)
 *   bun run mac tree                     # accessibility tree with frames
 *   bun run mac click "Reading list"     # click a node by label / identifier
 *   bun run mac click 120 64             # or a point
 *   bun run mac type hello
 *   bun run mac key cmd+k
 *
 * Coordinates everywhere are window points with a top-left origin: exactly
 * the pixel coordinates of a 1x screenshot of that window.
 *
 * Window selection (default: the key window, else the first visible one):
 *   --window=<substring>  match the title, case-insensitive
 *   --id=<n>              the window number from `list`
 *
 * Port: --port=<n>, else $RL_DEBUG_PORT, else 9400.
 */
import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describeBackend, DEV_USER, resolveBackend } from "./profiles";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAC_DIR = path.join(root, "mac");
const BUILD_DIR = path.join(MAC_DIR, "build");
const APP_BUNDLE = path.join(BUILD_DIR, "ReadingList.app");
const APP_EXECUTABLE = path.join(
  APP_BUNDLE,
  "Contents",
  "MacOS",
  "ReadingList",
);
const LOG_FILE = path.join(BUILD_DIR, "app.log");
const PID_FILE = path.join(BUILD_DIR, "app.pid");
const SCREENSHOT_DIR = path.join(tmpdir(), "reading-list-mac");
const DEFAULT_PORT = 9400;
const LAUNCH_TIMEOUT_MS = 20_000;

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
const asString = (value: unknown) => (typeof value === "string" ? value : "");
const asNumber = (value: unknown) => (typeof value === "number" ? value : NaN);
const optionalString = (value: unknown) =>
  typeof value === "string" && value !== "" ? value : undefined;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Arguments

// Flags that take a value, so both `--out=file` and `--out file` work.
const VALUE_FLAGS = new Set([
  "limit",
  "title",
  "notes",
  "url",
  "starred",
  "read",
  "hiddenFromReview",
  "env",
  "email",
  "password",
  "port",
  "window",
  "id",
  "out",
  "lines",
  "delay",
  "count",
  "button",
]);

const argv = process.argv.slice(2);
const command = argv[0] ?? "help";
const flags = new Map<string, string>();
const positionals: string[] = [];
const rest = argv.slice(1);
for (let index = 0; index < rest.length; index++) {
  const arg = rest[index];
  if (arg === undefined) continue;
  if (!arg.startsWith("--")) {
    positionals.push(arg);
    continue;
  }
  const eq = arg.indexOf("=");
  if (eq !== -1) {
    flags.set(arg.slice(2, eq), arg.slice(eq + 1));
    continue;
  }
  const name = arg.slice(2);
  const next = rest[index + 1];
  if (VALUE_FLAGS.has(name) && next !== undefined && !next.startsWith("--")) {
    flags.set(name, next);
    index++;
  } else {
    flags.set(name, "true");
  }
}

const flagNumber = (name: string, fallback: number) => {
  const raw = flags.get(name);
  const value = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(value) ? value : fallback;
};

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const port = flagNumber(
  "port",
  Number(process.env.RL_DEBUG_PORT ?? "") || DEFAULT_PORT,
);

// ---------------------------------------------------------------------------
// The control socket: one JSON line out, one JSON line back.

const REQUEST_TIMEOUT_MS = 5_000;
// Posted input is handled on the next pass of the app's run loop.
const INPUT_SETTLE_MS = 150;
const PROBE_TIMEOUT_MS = 1_000;

// A connection can be accepted and then never answered (the app quitting,
// or its main thread stuck), so every request has a deadline and a dropped
// connection rejects instead of hanging.
const request = (
  cmd: string,
  args: Record<string, unknown> = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
) =>
  new Promise<unknown>((resolve, reject) => {
    const socket = createConnection({ host: "127.0.0.1", port }, () => {
      socket.write(`${JSON.stringify({ id: 1, cmd, args })}\n`);
    });
    socket.setEncoding("utf8");
    let buffer = "";
    let settled = false;
    const finish = (outcome: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      outcome();
    };
    const timer = setTimeout(
      () =>
        finish(() =>
          reject(new Error(`No reply to "${cmd}" within ${timeoutMs}ms.`)),
        ),
      timeoutMs,
    );
    socket.on("data", (chunk: string) => {
      buffer += chunk;
      const newline = buffer.indexOf("\n");
      if (newline === -1) return;
      let message: Record<string, unknown>;
      try {
        message = asRecord(JSON.parse(buffer.slice(0, newline)));
      } catch {
        finish(() => reject(new Error("Malformed reply from the app.")));
        return;
      }
      finish(() => {
        if (message.ok === true) resolve(message.result);
        else reject(new Error(asString(message.error) || "Command failed."));
      });
    });
    socket.on("error", (error: Error) => finish(() => reject(error)));
    socket.on("close", () =>
      finish(() => reject(new Error("The app closed the connection."))),
    );
  });

const isUp = () =>
  request("ping", {}, PROBE_TIMEOUT_MS).then(
    () => true,
    () => false,
  );

const waitUntil = async (
  predicate: () => Promise<boolean>,
  timeoutMs: number,
) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await sleep(100);
  }
  return false;
};

// Bring the app to the front. `NSApp.activate()` is refused for a process
// nobody has clicked on (cooperative activation), LaunchServices is not; the
// socket call then makes the chosen window key.
const activate = async (win?: WindowInfo) => {
  const target = win ?? (await pickWindow());
  const deadline = Date.now() + 4_000;
  let latest = target;
  while (Date.now() < deadline) {
    spawnSync("open", [APP_BUNDLE], { stdio: "ignore" });
    latest = parseWindow(await request("activate", { window: target.id }));
    if (latest.active && latest.key) return latest;
    await sleep(250);
  }
  console.error(
    "note: macOS refused to activate the app (someone is busy in another app?); input may be dropped.",
  );
  return latest;
};

// Input goes to the active app: AppKit drops the first click on an inactive
// window (unless the view accepts first-mouse) and sends keys to the key
// window only. --no-activate leaves the app where it is.
const inputWindow = async () => {
  const win = await pickWindow();
  if (win.active && win.key) return win;
  if (flags.has("no-activate")) return win;
  return activate(win);
};

const requireApp = async () => {
  if (await isUp()) return;
  fail(
    `Nothing is listening on 127.0.0.1:${port}.\n` +
      "Start the app with `bun run mac run` (the socket is debug-only).",
  );
};

// ---------------------------------------------------------------------------
// Windows

type WindowInfo = {
  id: number;
  title: string;
  key: boolean;
  width: number;
  height: number;
  scale: number;
  x: number;
  y: number;
  appearance: string;
  firstResponder: string;
  active: boolean;
};

const parseWindow = (value: unknown): WindowInfo => {
  const record = asRecord(value);
  return {
    id: asNumber(record.id),
    title: asString(record.title),
    key: record.key === true,
    width: asNumber(record.width),
    height: asNumber(record.height),
    scale: asNumber(record.scale),
    x: asNumber(record.x),
    y: asNumber(record.y),
    appearance: asString(record.appearance),
    firstResponder: asString(record.firstResponder),
    active: record.active === true,
  };
};

const listWindows = async () => {
  const raw = await request("windows");
  return (Array.isArray(raw) ? raw : []).map(parseWindow);
};

const describeWindow = (win: WindowInfo) =>
  `[${win.id}] "${win.title}" ${Math.round(win.width)}x${Math.round(win.height)}` +
  ` @${win.scale}x ${win.appearance.includes("Dark") ? "dark" : "light"}` +
  `${win.key ? " key" : ""}${win.active ? "" : " (app inactive)"}` +
  `${win.firstResponder ? ` focus ${win.firstResponder}` : ""}`;

const pickWindow = async (): Promise<WindowInfo> => {
  const windows = await listWindows();
  if (windows.length === 0) fail("The app has no visible window.");
  const id = flags.get("id");
  if (id !== undefined) {
    return (
      windows.find((win) => win.id === Number(id)) ??
      fail(`No window with id ${id}. Try \`list\`.`)
    );
  }
  const needle = flags.get("window")?.toLowerCase();
  if (needle !== undefined) {
    return (
      windows.find((win) => win.title.toLowerCase().includes(needle)) ??
      fail(`No window matching "${needle}". Try \`list\`.`)
    );
  }
  return windows.find((win) => win.key) ?? windows[0] ?? fail("No window.");
};

// ---------------------------------------------------------------------------
// Accessibility tree

type TreeNode = {
  role: string;
  subrole?: string;
  label?: string;
  title?: string;
  value?: string;
  placeholder?: string;
  id?: string;
  frame: [number, number, number, number];
  disabled: boolean;
  focused: boolean;
  selected: boolean;
  hidden: boolean;
  children: TreeNode[];
};

const ROLE_NAMES: Record<string, string> = {
  AXStaticText: "text",
  AXTextField: "textfield",
  AXTextArea: "textarea",
  AXSearchField: "searchfield",
  AXButton: "button",
  AXCheckBox: "checkbox",
  AXRadioButton: "radio",
  AXPopUpButton: "popup",
  AXMenuButton: "menubutton",
  AXMenu: "menu",
  AXMenuItem: "menuitem",
  AXRow: "row",
  AXCell: "cell",
  AXOutline: "outline",
  AXTable: "table",
  AXList: "list",
  AXGroup: "group",
  AXScrollArea: "scroll",
  AXScrollBar: "scrollbar",
  AXSplitGroup: "split",
  AXSplitter: "splitter",
  AXToolbar: "toolbar",
  AXWindow: "window",
  AXImage: "image",
  AXLink: "link",
  AXSlider: "slider",
  AXHeading: "heading",
  AXDisclosureTriangle: "disclosure",
  AXTabGroup: "tabs",
  AXUnknown: "unknown",
};

const roleName = (raw: string) =>
  ROLE_NAMES[raw] ?? raw.replace(/^AX/, "").toLowerCase();

const parseNode = (value: unknown): TreeNode => {
  const record = asRecord(value);
  const rawFrame = Array.isArray(record.frame) ? record.frame : [];
  return {
    role: roleName(asString(record.role)),
    subrole: optionalString(record.subrole)?.replace(/^AX/, ""),
    label: optionalString(record.label),
    title: optionalString(record.title),
    value: optionalString(record.value),
    placeholder: optionalString(record.placeholder),
    id: optionalString(record.id),
    frame: [
      asNumber(rawFrame[0]),
      asNumber(rawFrame[1]),
      asNumber(rawFrame[2]),
      asNumber(rawFrame[3]),
    ],
    disabled: record.disabled === true,
    focused: record.focused === true,
    selected: record.selected === true,
    hidden: record.hidden === true,
    children: (Array.isArray(record.children) ? record.children : []).map(
      parseNode,
    ),
  };
};

const fetchTree = async (win: WindowInfo) =>
  parseNode(await request("tree", { window: win.id }));

const nodeName = (node: TreeNode) => node.label ?? node.title;
const isNamed = (node: TreeNode) =>
  nodeName(node) !== undefined ||
  node.value !== undefined ||
  node.placeholder !== undefined ||
  node.id !== undefined;
const hasFrame = (node: TreeNode) => node.frame[2] > 0 && node.frame[3] > 0;
const isVisible = (node: TreeNode) => hasFrame(node) && !node.hidden;

// Rows, buttons and fields before plain text, exact name matches first.
const INTERACTIVE_ROLES = new Set([
  "row",
  "button",
  "textfield",
  "textarea",
  "searchfield",
  "checkbox",
  "radio",
  "popup",
  "menubutton",
  "menuitem",
  "link",
  "slider",
  "disclosure",
]);

const describeNode = (node: TreeNode) => {
  const parts = [node.subrole ? `${node.role}:${node.subrole}` : node.role];
  const name = nodeName(node);
  if (name !== undefined) parts.push(JSON.stringify(name));
  if (node.value !== undefined && node.value !== name)
    parts.push(`= ${JSON.stringify(node.value)}`);
  if (node.placeholder !== undefined)
    parts.push(`placeholder ${JSON.stringify(node.placeholder)}`);
  if (node.id !== undefined) parts.push(`#${node.id}`);
  const [x, y, width, height] = node.frame;
  parts.push(`(${x},${y} ${width}x${height})`);
  const states = [
    node.selected ? "selected" : null,
    node.focused && node.role !== "window" ? "focused" : null,
    node.disabled && INTERACTIVE_ROLES.has(node.role) ? "disabled" : null,
    node.hidden ? "hidden" : null,
  ].filter((state) => state !== null);
  if (states.length > 0) parts.push(`[${states.join(" ")}]`);
  return parts.join(" ");
};

// Unnamed groups add nesting without information; their children print at
// the parent's depth. Invisible subtrees are dropped unless --all.
const COLLAPSED_ROLES = new Set(["group", "unknown", "cell"]);

const renderTree = (
  node: TreeNode,
  depth: number,
  all: boolean,
  lines: string[],
) => {
  if (!all && !isVisible(node)) return;
  const collapse = !all && !isNamed(node) && COLLAPSED_ROLES.has(node.role);
  if (!collapse) lines.push(`${"  ".repeat(depth)}${describeNode(node)}`);
  for (const child of node.children) {
    renderTree(child, collapse ? depth : depth + 1, all, lines);
  }
};

const flatten = (node: TreeNode, out: TreeNode[] = []) => {
  out.push(node);
  for (const child of node.children) flatten(child, out);
  return out;
};

const findNodes = async (win: WindowInfo, query: string) => {
  const needle = query.toLowerCase();
  const matches = (node: TreeNode) =>
    [node.label, node.title, node.value, node.id, node.placeholder].some(
      (field) => field?.toLowerCase().includes(needle),
    );
  const exact = (node: TreeNode) =>
    [node.label, node.title, node.id].some(
      (field) => field?.toLowerCase() === needle,
    );
  const rank = (node: TreeNode) =>
    (exact(node) ? 0 : 2) + (INTERACTIVE_ROLES.has(node.role) ? 0 : 1);
  return flatten(await fetchTree(win))
    .filter((node) => isVisible(node) && matches(node))
    .sort((a, b) => rank(a) - rank(b));
};

// `x y` as numbers, else the first positional is a label / identifier.
const resolvePoint = async (win: WindowInfo) => {
  const [first, second] = positionals;
  const x = Number(first);
  const y = Number(second);
  if (
    first !== undefined &&
    second !== undefined &&
    Number.isFinite(x) &&
    Number.isFinite(y)
  ) {
    return { x, y, label: `(${x}, ${y})` };
  }
  if (first === undefined) return fail("Needs `x y` or a label to look for.");
  const nodes = await findNodes(win, first);
  const target = nodes[0];
  if (target === undefined) {
    return fail(
      `Nothing visible matches "${first}". Try \`tree\` or \`find\`.`,
    );
  }
  if (nodes.length > 1) {
    console.error(
      `note: ${nodes.length} matches, using the first:\n  ${nodes
        .slice(0, 5)
        .map(describeNode)
        .join("\n  ")}`,
    );
  }
  const [left, top, width, height] = target.frame;
  return {
    x: Math.round(left + width / 2),
    y: Math.round(top + height / 2),
    label: describeNode(target),
  };
};

const modifierFlags = () =>
  ["cmd", "shift", "alt", "ctrl"].filter((name) => flags.has(name));

// ---------------------------------------------------------------------------
// Build, launch, stop

const build = () => {
  const result = spawnSync("sh", [path.join(MAC_DIR, "scripts", "bundle.sh")], {
    stdio: "inherit",
  });
  if (result.status !== 0) fail("Build failed.");
};

const readPid = () => {
  try {
    const pid = Number(readFileSync(PID_FILE, "utf8").trim());
    return Number.isFinite(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
};

const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const stop = async () => {
  let stopped = false;
  if (await isUp()) {
    try {
      await request("quit");
      stopped = true;
    } catch {}
    await waitUntil(async () => !(await isUp()), 5_000);
  }
  const pid = readPid();
  if (pid !== null && isAlive(pid)) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {}
    if (!(await waitUntil(async () => !isAlive(pid), 3_000))) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {}
    }
    stopped = true;
  }
  return stopped;
};

// Which backend the app talks to, from the same profiles every shell uses
// (scripts/profiles.ts): the local stack with the web dev server on :3000,
// or the hosted project with the deployed web app. The Supabase url and key
// ride in as RL_* env vars.
const backendEnv = () => {
  let backend;
  try {
    backend = resolveBackend(flags.get("env") ?? undefined);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
  console.log(describeBackend(backend));
  return {
    RL_SUPABASE_URL: backend.supabaseUrl,
    RL_SUPABASE_ANON_KEY: backend.values.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    RL_API_BASE: backend.api,
  };
};

const launch = async () => {
  if (!existsSync(APP_EXECUTABLE)) {
    fail(`No build at ${APP_EXECUTABLE}. Run \`bun run mac build\` first.`);
  }
  const backend = backendEnv();
  mkdirSync(BUILD_DIR, { recursive: true });
  const log = openSync(LOG_FILE, "w");
  const child = spawn(APP_EXECUTABLE, [], {
    detached: true,
    stdio: ["ignore", log, log],
    env: { ...process.env, ...backend, RL_DEBUG_PORT: String(port) },
  });
  child.unref();
  const pid = child.pid;
  if (pid === undefined) return fail("Could not launch the app.");
  writeFileSync(PID_FILE, String(pid));
  if (!(await waitUntil(isUp, LAUNCH_TIMEOUT_MS))) {
    fail(
      `The app did not answer on 127.0.0.1:${port} within ${LAUNCH_TIMEOUT_MS / 1000}s. Log: ${LOG_FILE}`,
    );
  }
  if (!flags.has("no-activate")) await activate();
  // The saved session restores a moment after launch; wait for it so the
  // next command finds the store.
  let session = "unknown";
  await waitUntil(async () => {
    const who = asRecord(await request("whoami").catch(() => ({})));
    session = asString(who.state) || "unknown";
    return session !== "unknown";
  }, 8_000);
  const windows = await listWindows();
  console.log(
    `running: pid ${pid}, control socket 127.0.0.1:${port}, session ${session}, log ${LOG_FILE}`,
  );
  for (const win of windows) console.log(`  ${describeWindow(win)}`);
};

// ---------------------------------------------------------------------------
// Screenshots

const slugify = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "window";

const screenshot = async (win: WindowInfo, outPath: string) => {
  mkdirSync(path.dirname(outPath), { recursive: true });
  const delay = flagNumber("delay", 0);
  if (delay > 0) await sleep(delay);
  // -x: no sound. Default is -l (this window only, -o without its shadow),
  // rendered by the window server. --screen grabs the screen region under
  // the window instead, i.e. what is really on the display, including
  // whatever shows through the glass and anything covering the window.
  const region = [win.x, win.y, win.width, win.height]
    .map((value) => Math.round(value))
    .join(",");
  const capture = spawnSync(
    "screencapture",
    flags.has("screen")
      ? ["-x", "-R", region, outPath]
      : ["-x", "-o", "-l", String(win.id), outPath],
    { encoding: "utf8" },
  );
  if (capture.status !== 0 || !existsSync(outPath)) {
    fail(
      `screencapture failed${capture.stderr ? `: ${capture.stderr.trim()}` : ""}.`,
    );
  }
  const retina = flags.has("retina");
  if (!retina) {
    // Down to 1x so pixel coordinates in the image are window points.
    spawnSync(
      "sips",
      [
        "--resampleHeightWidth",
        String(Math.round(win.height)),
        String(Math.round(win.width)),
        outPath,
      ],
      { stdio: "ignore" },
    );
  }
  const notes = [
    `${Math.round(win.width)}x${Math.round(win.height)} points`,
    retina ? `${win.scale}x` : "1x",
    win.appearance.includes("Dark") ? "dark" : "light",
  ];
  if (!win.active) {
    notes.push("app inactive, `bun run mac activate` for the focused look");
  }
  console.log(`${outPath}  (${notes.join(", ")})`);
};

// ---------------------------------------------------------------------------

const HELP = `bun run mac <command> [args] [flags]

  build                     swift build + assemble mac/build/ReadingList.app
  run                       build (unless --no-build), relaunch, wait for the socket
                            (--env=local|prod picks the backend; local by default)
  signin                    sign in with email and password (--email --password;
                            the local dev user by default), signout, whoami
  stop                      quit the running app
  log                       the app's stdout/stderr (--lines=<n>)
  list                      visible windows with their ids
  screenshot [file]         1x PNG of the window (--retina for 2x, --all for every
                            window, --screen for the composited screen region,
                            --delay=<ms> to wait first)
  tree                      accessibility tree with frames (--all keeps invisible
                            nodes, --json for the raw dump)
  find <text>               visible nodes whose label / value / id contains text
  text                      every visible label and value
  click <x> <y> | <text>    click a point or the centre of a node
                            (--right, --double, --cmd --shift --alt --ctrl)
  hover <x> <y> | <text>    move the cursor there
  scroll <x> <y> <dy>       scroll the scroll view under the point by dy points
  type <text>               type into whatever has focus
  key <spec>                return | escape | tab | up | down | cmd+k | cmd+shift+[ …
  activate                  bring the app to the front (input commands do this
                            themselves unless --no-activate)
  move <x> <y>              put the window's top-left corner at screen point x,y
  resize <w> <h>            set the window size in points
  appearance <mode>         light | dark | system
  board [name]              open the design board on a demo (slug or title), or everything
  items | item <id>         the store as the app sees it (--limit=<n>)
  refresh                   refetch from the database
  create [url]              a blank item, or one from a url
  patch <id> --title=… --notes=… --url=… --starred=true|false --read=…
  delete <id>
  open [id]                 show an item in the pane, or the list
  close                     close the window (--window=<title> picks one)
  blur                      give up the first responder (ends an in-place edit)
  dev <state>               the dev bar's preview: shell | review | sign-in | loading | error | missing-config
  oauth-url                 the Google sign-in url the app would open
  settings [--theme=… --density=… --groupBy=… --sortBy=… --showRead=… --sounds=…]
                            the user's settings, optionally changed
  review [itemId]           show the review pane (scoped to an item's cards)
  cards                     the deck as the app sees it (--limit=<n>)

flags: --window=<title substring> --id=<n> --port=<n>`;

const run = async () => {
  switch (command) {
    case "help":
    case "--help": {
      console.log(HELP);
      return;
    }
    case "build": {
      build();
      return;
    }
    case "run": {
      if (!flags.has("no-build")) build();
      await stop();
      await launch();
      return;
    }
    case "stop": {
      console.log((await stop()) ? "stopped" : "not running");
      return;
    }
    case "log": {
      if (!existsSync(LOG_FILE)) fail(`No log at ${LOG_FILE}.`);
      const lines = readFileSync(LOG_FILE, "utf8").trimEnd().split("\n");
      console.log(lines.slice(-flagNumber("lines", 40)).join("\n"));
      return;
    }
    default:
      break;
  }

  await requireApp();
  const [firstArg, secondArg, thirdArg] = positionals;

  switch (command) {
    case "list": {
      const windows = await listWindows();
      console.log(`control socket :${port} — ${windows.length} window(s)`);
      for (const win of windows) console.log(`  ${describeWindow(win)}`);
      break;
    }
    case "screenshot": {
      if (flags.has("all")) {
        for (const win of await listWindows()) {
          await screenshot(
            win,
            path.join(SCREENSHOT_DIR, `${slugify(win.title)}-${win.id}.png`),
          );
        }
        break;
      }
      const win = await pickWindow();
      await screenshot(
        win,
        firstArg ?? path.join(SCREENSHOT_DIR, `${slugify(win.title)}.png`),
      );
      break;
    }
    case "tree": {
      const win = await pickWindow();
      if (flags.has("json")) {
        console.log(
          JSON.stringify(await request("tree", { window: win.id }), null, 2),
        );
        break;
      }
      const lines: string[] = [];
      renderTree(await fetchTree(win), 0, flags.has("all"), lines);
      console.log(lines.join("\n"));
      break;
    }
    case "find": {
      if (firstArg === undefined) fail("find needs text to look for.");
      const nodes = await findNodes(await pickWindow(), String(firstArg));
      if (nodes.length === 0) console.log("no visible match");
      for (const node of nodes) console.log(describeNode(node));
      break;
    }
    case "text": {
      const lines = flatten(await fetchTree(await pickWindow()))
        .filter((node) => isVisible(node))
        .flatMap((node) =>
          [nodeName(node), node.value].filter(
            (field): field is string => field !== undefined,
          ),
        );
      console.log([...new Set(lines)].join("\n"));
      break;
    }
    case "click": {
      const win = await inputWindow();
      const point = await resolvePoint(win);
      await request("click", {
        window: win.id,
        x: point.x,
        y: point.y,
        button: flags.has("right") ? "right" : (flags.get("button") ?? "left"),
        count: flags.has("double") ? 2 : flagNumber("count", 1),
        modifiers: modifierFlags(),
      });
      await sleep(INPUT_SETTLE_MS);
      console.log(`clicked ${point.label} at (${point.x}, ${point.y})`);
      break;
    }
    case "hover": {
      const win = await inputWindow();
      const point = await resolvePoint(win);
      await request("hover", { window: win.id, x: point.x, y: point.y });
      await sleep(INPUT_SETTLE_MS);
      console.log(`hovering ${point.label} at (${point.x}, ${point.y})`);
      break;
    }
    case "scroll": {
      const win = await inputWindow();
      const [x, y, dy] = [
        Number(firstArg),
        Number(secondArg),
        Number(thirdArg),
      ];
      if (![x, y, dy].every(Number.isFinite)) fail("scroll needs x y dy.");
      await request("scroll", { window: win.id, x, y, dy });
      await sleep(INPUT_SETTLE_MS);
      console.log(`scrolled by ${dy} at (${x}, ${y})`);
      break;
    }
    case "type": {
      if (firstArg === undefined) fail("type needs text.");
      const win = await inputWindow();
      await request("type", { window: win.id, text: positionals.join(" ") });
      await sleep(INPUT_SETTLE_MS);
      console.log(`typed ${JSON.stringify(positionals.join(" "))}`);
      break;
    }
    case "key": {
      if (firstArg === undefined)
        fail("key needs a key spec, e.g. return or cmd+k.");
      const win = await inputWindow();
      await request("key", { window: win.id, key: String(firstArg) });
      await sleep(INPUT_SETTLE_MS);
      console.log(`pressed ${firstArg}`);
      break;
    }
    case "activate": {
      const win = await pickWindow();
      console.log(
        describeWindow(
          parseWindow(await request("activate", { window: win.id })),
        ),
      );
      break;
    }
    case "move": {
      const win = await pickWindow();
      const [x, y] = [Number(firstArg), Number(secondArg)];
      if (!Number.isFinite(x) || !Number.isFinite(y)) fail("move needs x y.");
      console.log(
        describeWindow(
          parseWindow(await request("move", { window: win.id, x, y })),
        ),
      );
      break;
    }
    case "resize": {
      const win = await pickWindow();
      const [width, height] = [Number(firstArg), Number(secondArg)];
      if (!Number.isFinite(width) || !Number.isFinite(height))
        fail("resize needs width height.");
      console.log(
        describeWindow(
          parseWindow(
            await request("resize", { window: win.id, width, height }),
          ),
        ),
      );
      break;
    }
    case "signin": {
      // The local stack's dev user by default (scripts/setup-local-supabase.ts).
      const email =
        flags.get("email") ?? process.env.DEV_USER_EMAIL ?? DEV_USER.email;
      const password =
        flags.get("password") ??
        process.env.DEV_USER_PASSWORD ??
        DEV_USER.password;
      await request("signin", { email, password }, 20_000);
      await sleep(600);
      console.log(JSON.stringify(await request("whoami")));
      break;
    }
    case "signout": {
      await request("signout", {}, 20_000);
      console.log("signed out");
      break;
    }
    case "whoami": {
      console.log(JSON.stringify(await request("whoami")));
      break;
    }
    case "items": {
      // The store as the app sees it (count, sync time, the first rows).
      console.log(
        JSON.stringify(
          await request("items", { limit: flagNumber("limit", 20) }),
          null,
          2,
        ),
      );
      break;
    }
    case "item": {
      if (firstArg === undefined) fail("item needs an id.");
      console.log(
        JSON.stringify(await request("item", { id: firstArg }), null, 2),
      );
      break;
    }
    case "refresh": {
      await request("refresh");
      console.log("refreshing");
      break;
    }
    case "create": {
      // A blank item, or one from a url (the server fetches its title).
      console.log(
        JSON.stringify(
          await request("create", firstArg ? { url: firstArg } : {}),
        ),
      );
      break;
    }
    case "patch": {
      // patch <id> --title=... --notes=... --url=... --starred --read
      if (firstArg === undefined) fail("patch needs an id.");
      const fields: Record<string, unknown> = {};
      for (const key of ["title", "notes", "url"]) {
        const value = flags.get(key);
        if (value !== undefined) fields[key] = value;
      }
      for (const key of ["starred", "read", "hiddenFromReview"]) {
        const value = flags.get(key);
        if (value !== undefined) fields[key] = value === "true";
      }
      console.log(
        JSON.stringify(await request("patch", { id: firstArg, ...fields })),
      );
      break;
    }
    case "delete": {
      if (firstArg === undefined) fail("delete needs an id.");
      console.log(JSON.stringify(await request("delete", { id: firstArg })));
      break;
    }
    case "open": {
      // open <id> shows the item; open alone shows the list.
      console.log(
        JSON.stringify(await request("open", firstArg ? { id: firstArg } : {})),
      );
      break;
    }
    case "oauth-url": {
      // The Google sign-in url the app would open, for inspection.
      console.log(JSON.stringify(await request("oauth-url", {})));
      break;
    }
    case "settings": {
      // settings [--theme=… --density=… --groupBy=… --sortBy=… --showRead=… --sounds=…]
      const patch: Record<string, unknown> = {};
      for (const key of ["theme", "density", "groupBy", "sortBy"]) {
        const value = flags.get(key);
        if (value !== undefined) patch[key] = value;
      }
      for (const key of ["showRead", "sounds"]) {
        const value = flags.get(key);
        if (value !== undefined) patch[key] = value === "true";
      }
      console.log(JSON.stringify(await request("settings", patch), null, 2));
      break;
    }
    case "dev": {
      // dev <state>: preview a UI state (shell, review, sign-in, loading, error, missing-config).
      console.log(JSON.stringify(await request("dev", { state: firstArg })));
      break;
    }
    case "close": {
      console.log(JSON.stringify(await request("close", {})));
      break;
    }
    case "blur": {
      console.log(JSON.stringify(await request("blur", {})));
      break;
    }
    case "review": {
      // review <itemId> scopes the pane to that item's cards.
      console.log(
        JSON.stringify(
          await request("review", firstArg ? { id: firstArg } : {}),
        ),
      );
      break;
    }
    case "cards": {
      console.log(
        JSON.stringify(
          await request("cards", { limit: flagNumber("limit", 20) }),
          null,
          2,
        ),
      );
      break;
    }
    case "board": {
      // Opens the design board window on one demo (or everything).
      await request("board", { name: firstArg ?? "everything" });
      await sleep(400);
      const boards = (await listWindows()).filter((win) =>
        win.title.toLowerCase().includes("design"),
      );
      console.log(
        `board: ${firstArg ?? "everything"}${boards[0] ? ` in window ${describeWindow(boards[0])}` : ""}`,
      );
      break;
    }
    case "appearance": {
      if (firstArg === undefined)
        fail("appearance needs light, dark or system.");
      await request("appearance", { mode: String(firstArg) });
      console.log(`appearance ${firstArg}`);
      break;
    }
    default:
      fail(`Unknown command "${command}".\n\n${HELP}`);
  }
};

await run();
