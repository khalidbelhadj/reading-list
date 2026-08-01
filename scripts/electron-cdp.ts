#!/usr/bin/env bun
/**
 * Attach to the running dev Electron app over the Chrome DevTools Protocol.
 *
 * The Browser pane / preview harness can only ever show the *web* build in a
 * tab. Electron differs in ways that only reproduce in the real app: secondary
 * item and review windows (window.open → real BrowserWindows), the viewer
 * <webview> guests, traffic-light clearance, app-wide zoom, native theme, deep
 * links. Every one of those webContents is its own CDP target, so attaching
 * here is the way to see and drive the desktop UI as it actually runs.
 *
 * Start the app first (`bun run electron:local`), then:
 *
 *   bun scripts/electron-cdp.ts list
 *   bun scripts/electron-cdp.ts screenshot --all --out /tmp/shots
 *   bun scripts/electron-cdp.ts eval 'document.title'
 *   bun scripts/electron-cdp.ts eval --target=review 'location.href'
 *   bun scripts/electron-cdp.ts console --ms=15000
 *   bun scripts/electron-cdp.ts click '[data-testid="add-item"]'
 *   bun scripts/electron-cdp.ts text 'main'
 *
 * Target selection (default: the first page target, i.e. the main window):
 *   --target=<substring>  match window title or URL, case-insensitive
 *   --index=<n>           position in `list` output
 *   --id=<targetId>       exact CDP target id
 *
 * Port: --port=<n>, else $ELECTRON_CDP_PORT, else scan 9222-9231 (electron/
 * main.ts derives the port from the dev port, so instance :3001 → 9223).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const CDP_BASE_PORT = 9222;
const PORT_SCAN_COUNT = 10;
const PROBE_TIMEOUT_MS = 400;

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};

const asString = (value: unknown) => (typeof value === "string" ? value : "");

// ---------------------------------------------------------------------------
// Arguments

// Flags that take a value, so both `--out=dir` and `--out dir` work. Without
// this list the space form parses as a bare boolean plus a stray positional —
// which silently wrote screenshots into a directory named "true".
const VALUE_FLAGS = new Set(["port", "target", "index", "id", "ms", "out"]);

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

// ---------------------------------------------------------------------------
// Target discovery

type Target = {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl: string;
};

const probePort = async (port: number) => {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
};

const resolvePort = async () => {
  const explicit = flags.get("port") ?? process.env.ELECTRON_CDP_PORT;
  if (explicit) return Number(explicit);

  const ports: number[] = [];
  for (let offset = 0; offset < PORT_SCAN_COUNT; offset++) {
    const port = CDP_BASE_PORT + offset;
    if (await probePort(port)) ports.push(port);
  }
  const [first] = ports;
  if (first === undefined) {
    return fail(
      "No Electron CDP listener found on 9222-9231.\n" +
        "Start the app with `bun run electron:local` (the listener is dev-only,\n" +
        "and its port is printed as `[electron] CDP listening on ...`).",
    );
  }
  if (ports.length > 1) {
    return fail(
      `Multiple dev instances are listening (${ports.join(", ")}). ` +
        "Pick one with --port=<n>.",
    );
  }
  return first;
};

const fetchTargets = async (port: number) => {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  const raw: unknown = await response.json();
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((entry) => {
      const record = asRecord(entry);
      return {
        id: asString(record.id),
        type: asString(record.type),
        title: asString(record.title),
        url: asString(record.url),
        webSocketDebuggerUrl: asString(record.webSocketDebuggerUrl),
      } satisfies Target;
    })
    .filter(
      (target) =>
        target.webSocketDebuggerUrl !== "" &&
        (flags.has("all-types") ||
          target.type === "page" ||
          target.type === "webview"),
    );
};

// Windows the app opens carry their identity in the URL: ?window= is a
// dedicated item window, /review/ is a review session, everything else on the
// app origin is a list window. Surfaced in `list` so the right one is pickable.
const describeTarget = (target: Target) => {
  if (target.type === "webview") return "viewer webview";
  try {
    const url = new URL(target.url);
    if (url.pathname.startsWith("/review/")) return "review window";
    if (url.searchParams.get("window") != null) return "item window";
    if (url.searchParams.get("item") != null) return "list window (item open)";
    return "list window";
  } catch {
    return target.type;
  }
};

const pickTarget = (targets: Target[]) => {
  const id = flags.get("id");
  if (id) {
    const match = targets.find((target) => target.id === id);
    return match ?? fail(`No target with id ${id}.`);
  }

  const needle = flags.get("target")?.toLowerCase();
  if (needle) {
    const match = targets.find(
      (target) =>
        target.title.toLowerCase().includes(needle) ||
        target.url.toLowerCase().includes(needle),
    );
    return match ?? fail(`No target matching "${needle}". Try \`list\`.`);
  }

  const index = flagNumber("index", 0);
  const match = targets[index];
  return match ?? fail(`No target at index ${index}. Try \`list\`.`);
};

// ---------------------------------------------------------------------------
// CDP session

type Handler = (params: Record<string, unknown>) => void;

class CdpSession {
  private nextId = 1;
  private readonly pending = new Map<
    number,
    {
      resolve: (value: Record<string, unknown>) => void;
      reject: (error: Error) => void;
    }
  >();
  private readonly listeners = new Map<string, Handler[]>();

  private constructor(private readonly socket: WebSocket) {}

  static connect(url: string) {
    return new Promise<CdpSession>((resolve, reject) => {
      const socket = new WebSocket(url);
      const session = new CdpSession(socket);
      socket.onopen = () => resolve(session);
      socket.onerror = () => reject(new Error(`Failed to connect to ${url}`));
      socket.onmessage = (event) => session.receive(String(event.data));
    });
  }

  private receive(data: string) {
    let message: Record<string, unknown>;
    try {
      message = asRecord(JSON.parse(data));
    } catch {
      return;
    }

    const id = message.id;
    if (typeof id === "number") {
      const waiter = this.pending.get(id);
      if (!waiter) return;
      this.pending.delete(id);
      const error = asRecord(message.error);
      if (typeof error.message === "string")
        waiter.reject(new Error(error.message));
      else waiter.resolve(asRecord(message.result));
      return;
    }

    const method = asString(message.method);
    for (const handler of this.listeners.get(method) ?? []) {
      handler(asRecord(message.params));
    }
  }

  on(method: string, handler: Handler) {
    this.listeners.set(method, [
      ...(this.listeners.get(method) ?? []),
      handler,
    ]);
  }

  send(method: string, params: Record<string, unknown> = {}) {
    const id = this.nextId++;
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

/** Runtime.evaluate with promise-awaiting + by-value results; throws on page exceptions. */
const evaluate = async (session: CdpSession, expression: string) => {
  const response = await session.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    includeCommandLineAPI: true,
  });
  const details = asRecord(response.exceptionDetails);
  if (Object.keys(details).length > 0) {
    const exception = asRecord(details.exception);
    throw new Error(
      asString(exception.description) ||
        asString(details.text) ||
        "Evaluation failed",
    );
  }
  return asRecord(response.result).value;
};

// ---------------------------------------------------------------------------
// Commands

const slugify = (target: Target, index: number) => {
  const label = describeTarget(target).replace(/[^a-z0-9]+/gi, "-");
  return `${String(index).padStart(2, "0")}-${label}`.toLowerCase();
};

const captureScreenshot = async (target: Target, outPath: string) => {
  const session = await CdpSession.connect(target.webSocketDebuggerUrl);
  await session.send("Page.enable");
  const response = await session.send("Page.captureScreenshot", {
    format: "png",
  });
  session.close();
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, Buffer.from(asString(response.data), "base64"));
  console.log(outPath);
};

// Real trusted input rather than el.click(): the app's own listeners, focus
// handling and hover state all behave as they do for a person at the keyboard.
const dispatchClick = async (session: CdpSession, selector: string) => {
  const point = asRecord(
    await evaluate(
      session,
      `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return null;
        el.scrollIntoView({ block: "center", behavior: "instant" });
        const rect = el.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      })()`,
    ),
  );
  const { x, y } = point;
  if (typeof x !== "number" || typeof y !== "number") {
    return fail(`No element matched ${selector}.`);
  }
  const base = { x, y, button: "left", clickCount: 1 };
  await session.send("Input.dispatchMouseEvent", {
    ...base,
    type: "mouseMoved",
  });
  await session.send("Input.dispatchMouseEvent", {
    ...base,
    type: "mousePressed",
  });
  await session.send("Input.dispatchMouseEvent", {
    ...base,
    type: "mouseReleased",
  });
  console.log(`clicked ${selector} at (${Math.round(x)}, ${Math.round(y)})`);
};

const KEY_CODES: Record<string, number> = {
  Enter: 13,
  Escape: 27,
  Tab: 9,
  Backspace: 8,
  ArrowUp: 38,
  ArrowDown: 40,
  ArrowLeft: 37,
  ArrowRight: 39,
};

const dispatchKey = async (session: CdpSession, key: string) => {
  const code = KEY_CODES[key];
  if (code === undefined) {
    return fail(
      `Unknown key "${key}". Known: ${Object.keys(KEY_CODES).join(", ")}.`,
    );
  }
  const base = { key, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code };
  await session.send("Input.dispatchKeyEvent", { ...base, type: "rawKeyDown" });
  await session.send("Input.dispatchKeyEvent", { ...base, type: "keyUp" });
  console.log(`pressed ${key}`);
};

const formatConsoleArgs = (args: unknown[]) =>
  args
    .map((arg) => {
      const record = asRecord(arg);
      if ("value" in record) return JSON.stringify(record.value);
      return asString(record.description) || asString(record.className) || "?";
    })
    .join(" ");

const tailConsole = async (session: CdpSession, durationMs: number) => {
  session.on("Runtime.consoleAPICalled", (params) => {
    const args = Array.isArray(params.args) ? params.args : [];
    console.log(`[${asString(params.type)}] ${formatConsoleArgs(args)}`);
  });
  session.on("Runtime.exceptionThrown", (params) => {
    const details = asRecord(params.exceptionDetails);
    const exception = asRecord(details.exception);
    console.log(
      `[error] ${asString(exception.description) || asString(details.text)}`,
    );
  });
  session.on("Log.entryAdded", (params) => {
    const entry = asRecord(params.entry);
    console.log(
      `[${asString(entry.level)}] ${asString(entry.text)} ${asString(entry.url)}`,
    );
  });
  await session.send("Runtime.enable");
  await session.send("Log.enable");
  console.log(`tailing console for ${durationMs}ms…`);
  await new Promise((resolve) => setTimeout(resolve, durationMs));
};

const HELP = `bun scripts/electron-cdp.ts <command> [args] [flags]

  list                      every window / webview target, with an index
  eval <expression>         run JS in the target and print the result
  text [selector]           innerText of the selector (default: body)
  html [selector]           outerHTML of the selector (default: documentElement)
  screenshot [file]         PNG of the target; --all captures every window
  console                   tail console + errors (--ms=5000)
  click <selector>          real mouse click at the element's center
  type <text>               insert text into the focused element
  key <name>                ${Object.keys(KEY_CODES).join(" | ")}
  reload                    reload the target
  navigate <url>            load a URL in the target

flags: --target=<substr> --index=<n> --id=<targetId> --port=<n> --all-types`;

const run = async () => {
  if (command === "help" || command === "--help") {
    console.log(HELP);
    return;
  }

  const port = await resolvePort();
  const targets = await fetchTargets(port);
  if (targets.length === 0) fail(`Nothing to attach to on port ${port}.`);

  if (command === "list") {
    console.log(`CDP :${port} — ${targets.length} target(s)`);
    targets.forEach((target, index) => {
      console.log(
        `  [${index}] ${describeTarget(target)}\n` +
          `      title: ${target.title}\n` +
          `      url:   ${target.url}\n` +
          `      id:    ${target.id}`,
      );
    });
    return;
  }

  if (command === "screenshot" && flags.has("all")) {
    const dir = flags.get("out") ?? path.join(tmpdir(), "electron-cdp");
    for (const [index, target] of targets.entries()) {
      await captureScreenshot(
        target,
        path.join(dir, `${slugify(target, index)}.png`),
      );
    }
    return;
  }

  const target = pickTarget(targets);
  const session = await CdpSession.connect(target.webSocketDebuggerUrl);
  const [firstArg] = positionals;

  switch (command) {
    case "eval": {
      if (!firstArg) fail("eval needs an expression.");
      console.log(
        JSON.stringify(await evaluate(session, String(firstArg)), null, 2),
      );
      break;
    }
    case "text": {
      const selector = firstArg ?? "body";
      console.log(
        await evaluate(
          session,
          `document.querySelector(${JSON.stringify(selector)})?.innerText ?? null`,
        ),
      );
      break;
    }
    case "html": {
      const selector = firstArg ?? "html";
      console.log(
        await evaluate(
          session,
          `document.querySelector(${JSON.stringify(selector)})?.outerHTML ?? null`,
        ),
      );
      break;
    }
    case "screenshot": {
      const out =
        firstArg ??
        path.join(
          tmpdir(),
          "electron-cdp",
          `${slugify(target, targets.indexOf(target))}.png`,
        );
      await captureScreenshot(target, out);
      break;
    }
    case "console": {
      await tailConsole(session, flagNumber("ms", 5000));
      break;
    }
    case "click": {
      if (!firstArg) fail("click needs a selector.");
      await dispatchClick(session, String(firstArg));
      break;
    }
    case "type": {
      if (!firstArg) fail("type needs text.");
      await session.send("Input.insertText", { text: String(firstArg) });
      break;
    }
    case "key": {
      if (!firstArg) fail("key needs a key name.");
      await dispatchKey(session, String(firstArg));
      break;
    }
    case "reload": {
      await session.send("Page.reload");
      break;
    }
    case "navigate": {
      if (!firstArg) fail("navigate needs a URL.");
      await session.send("Page.navigate", { url: String(firstArg) });
      break;
    }
    default:
      fail(`Unknown command "${command}".\n\n${HELP}`);
  }

  session.close();
};

await run();
