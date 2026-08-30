// Reads the tabs currently open in local browsers (macOS only) so the renderer
// can surface matching reading-list items at the top of the list.
//
// Two rules govern everything here:
//
//  1. Never launch a browser. `tell application "Google Chrome"` *starts*
//     Chrome if it isn't running, so a naive poll would boot every browser on
//     the user's machine on app launch. We check liveness with pgrep first —
//     which also avoids a second (System Events) automation prompt.
//  2. Never leave the machine. Tab data goes main → renderer over IPC and is
//     matched against the item cache in the client. Nothing is sent to the
//     server, stored, or logged.
//
// Polling only runs while a renderer is subscribed *and* an app window is
// focused, so a backgrounded app costs nothing.
//
// Firefox (and its forks) can never be supported here: `sdef` on Firefox.app
// returns only the stock Cocoa suites — no `tab` class, no `URL` anywhere — so
// the query fails to *compile*, long before any permission is consulted. That
// would need a WebExtension, not AppleScript.
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { app, BrowserWindow, ipcMain, type WebContents } from "electron";

import { APP_CHANNELS, type BrowserTab, type BrowserTabRef } from "./channels";

const run = promisify(execFile);

const POLL_MS = 2000;
const OSASCRIPT_TIMEOUT_MS = 5000;

// ASCII unit/record separators: safe against titles containing tabs, pipes or
// newlines, and — unlike `tab` — not an AppleScript keyword that collides with
// Chrome's `tab` class inside the tell block.
const UNIT = String.fromCharCode(31);
const RECORD = String.fromCharCode(30);

const isMac = process.platform === "darwin";

// Browsers whose automation the user declined (osascript -1743). Retrying just
// re-prompts, so we drop them for the life of the process.
const deniedApps = new Set<string>();

/**
 * `tabId` values arrive back from the renderer and are interpolated into a
 * script, so every one is quoted through here. Backslash first, then quote;
 * control characters are dropped since no legitimate id or URL contains one.
 */
const asAppleScriptString = (value: string) =>
  `"${value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')}"`;

type BrowserEntry = {
  /** Scripting name, and the exact process name pgrep -x must match. */
  app: string;
  /** Display name. */
  browser: string;
  /** Emits `active<US>tabId<US>url<RS>` per tab. */
  listScript: string;
  /** Raises the tab whose id is `tabId`; a no-op if it's gone. */
  focusScript: (tabId: string) => string;
};

// Chrome and its forks share one scripting dictionary, so one pair of scripts
// serves them all. Tabs carry a stable `id`, which is what we address them by:
// window/tab positions shift the moment a tab is opened, closed or dragged.
//
// `set tid to (id of t) as text` is load-bearing, both halves of it:
//   - binding to a local stops AppleScript building a bulk reference across
//     every tab of every window ("id of item 1 of every «class CrTb» of ...")
//     instead of reading one scalar;
//   - the `as text` coercion is required because a Chrome tab id is not a plain
//     integer, so `tid is 40334440` is false even when `tid as integer` equals
//     it.
// Get either wrong and the script still succeeds and exits 0 — it just
// silently matches nothing and does nothing.
const chromiumEntry = (app: string, browser: string): BrowserEntry => ({
  app,
  browser,
  listScript: `
set US to (ASCII character 31)
set RS to (ASCII character 30)
set out to ""
tell application "${app}"
  repeat with w in windows
    set skip to false
    try
      if (mode of w) is "incognito" then set skip to true
    end try
    if not skip then
      set ati to 0
      try
        set ati to active tab index of w
      end try
      set ti to 0
      repeat with t in tabs of w
        set ti to ti + 1
        set u to ""
        try
          set u to URL of t
        end try
        if u is not "" then
          set tid to (id of t) as text
          set out to out & ((ti = ati) as text) & US & tid & US & u & RS
        end if
      end repeat
    end if
  end repeat
end tell
return out
`,
  focusScript: (tabId) => `
tell application "${app}"
  repeat with w in windows
    set ti to 0
    repeat with t in tabs of w
      set ti to ti + 1
      set tid to (id of t) as text
      if tid is ${asAppleScriptString(tabId)} then
        set active tab index of w to ti
        set index of w to 1
        activate
        return
      end if
    end repeat
  end repeat
end tell
`,
});

// Safari's dictionary is its own: no `active tab index` (a window has a
// settable `current tab` instead) and — the awkward part — tabs carry no stable
// id, only a read-only positional `index`. So Safari tabs are addressed by URL,
// which for this feature is the identity anyway: a URL is exactly what we
// matched the item on. Same locals-then-compare discipline as above.
//
// Caveat: Safari exposes no private-browsing flag, so unlike Chrome's `mode of
// w` there is nothing to filter private windows on.
const safariEntry: BrowserEntry = {
  app: "Safari",
  browser: "Safari",
  listScript: `
set US to (ASCII character 31)
set RS to (ASCII character 30)
set out to ""
tell application "Safari"
  repeat with w in windows
    set ci to -1
    try
      set ci to index of (current tab of w)
    end try
    repeat with t in tabs of w
      set u to ""
      try
        set u to (URL of t) as text
      end try
      if u is not "" then
        set ti to index of t
        set out to out & ((ti = ci) as text) & US & u & US & u & RS
      end if
    end repeat
  end repeat
end tell
return out
`,
  focusScript: (tabId) => `
tell application "Safari"
  repeat with w in windows
    repeat with t in tabs of w
      set u to ""
      try
        set u to (URL of t) as text
      end try
      if u is ${asAppleScriptString(tabId)} then
        set current tab of w to t
        set index of w to 1
        activate
        return
      end if
    end repeat
  end repeat
end tell
`,
};

const BROWSERS: BrowserEntry[] = [
  chromiumEntry("Google Chrome", "Chrome"),
  chromiumEntry("Brave Browser", "Brave"),
  chromiumEntry("Microsoft Edge", "Edge"),
  chromiumEntry("Chromium", "Chromium"),
  safariEntry,
];

const isRunning = async (processName: string) => {
  try {
    await run("pgrep", ["-x", processName]);
    return true;
  } catch {
    // pgrep exits 1 when nothing matches — that's "not running", not an error.
    return false;
  }
};

const isPermissionDenied = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("-1743") || message.includes("Not authorized");
};

const parseRows = (stdout: string, entry: BrowserEntry): BrowserTab[] =>
  stdout
    .split(RECORD)
    .map((row) => row.split(UNIT))
    .filter((fields) => fields.length === 3)
    .map((fields) => ({
      app: entry.app,
      browser: entry.browser,
      active: fields[0] === "true",
      tabId: fields[1] ?? "",
      url: fields[2] ?? "",
    }))
    .filter((tab) => tab.url !== "" && tab.tabId !== "");

const listAppTabs = async (entry: BrowserEntry): Promise<BrowserTab[]> => {
  if (deniedApps.has(entry.app)) return [];
  if (!(await isRunning(entry.app))) return [];
  try {
    const { stdout } = await run("osascript", ["-e", entry.listScript], {
      timeout: OSASCRIPT_TIMEOUT_MS,
    });
    return parseRows(stdout, entry);
  } catch (error) {
    if (isPermissionDenied(error)) {
      deniedApps.add(entry.app);
      console.warn(
        `[browser-tabs] automation denied for ${entry.app}; not retrying. ` +
          `Re-enable under System Settings → Privacy & Security → Automation.`,
      );
    } else {
      console.warn(`[browser-tabs] list failed for ${entry.app}`, error);
    }
    return [];
  }
};

const listBrowserTabs = async (): Promise<BrowserTab[]> => {
  if (!isMac) return [];
  const perApp = await Promise.all(BROWSERS.map(listAppTabs));
  return perApp.flat();
};

const focusBrowserTab = async (ref: BrowserTabRef) => {
  if (!isMac) return;
  // Only ever address a browser from our own table — `ref` arrives from the
  // renderer, and an unvalidated app name would be osascript injection. The id
  // itself is quoted by asAppleScriptString.
  const entry = BROWSERS.find((candidate) => candidate.app === ref.app);
  if (!entry || deniedApps.has(entry.app)) return;
  if (typeof ref.tabId !== "string" || ref.tabId === "") return;
  if (!(await isRunning(entry.app))) return;
  try {
    await run("osascript", ["-e", entry.focusScript(ref.tabId)], {
      timeout: OSASCRIPT_TIMEOUT_MS,
    });
  } catch (error) {
    if (isPermissionDenied(error)) deniedApps.add(entry.app);
    // Anything else (a window that closed between poll and click, a fork whose
    // dictionary differs) is worth seeing rather than silently doing nothing.
    else console.warn("[browser-tabs] focus failed", error);
  }
};

// --- polling -------------------------------------------------------------

const subscribers = new Set<WebContents>();
let timer: NodeJS.Timeout | null = null;
let inFlight = false;
// Signature of the last broadcast payload. Tabs are polled but rarely change,
// so this keeps a 2s timer from re-rendering the list twice a second.
let lastSignature = "";

const signatureOf = (tabs: BrowserTab[]) =>
  tabs
    .map((tab) => `${tab.app}|${tab.tabId}|${tab.active ? 1 : 0}|${tab.url}`)
    .join("\n");

const broadcast = (tabs: BrowserTab[]) => {
  for (const contents of subscribers) {
    if (!contents.isDestroyed()) contents.send(APP_CHANNELS.browserTabs, tabs);
  }
};

const poll = async () => {
  // A slow osascript must not stack up behind the interval.
  if (inFlight) return;
  inFlight = true;
  try {
    const tabs = await listBrowserTabs();
    const signature = signatureOf(tabs);
    if (signature === lastSignature) return;
    lastSignature = signature;
    broadcast(tabs);
  } finally {
    inFlight = false;
  }
};

const shouldPoll = () =>
  isMac &&
  subscribers.size > 0 &&
  BrowserWindow.getAllWindows().some((win) => win.isFocused());

// Idempotent: safe to call on every focus, subscribe and unsubscribe.
const syncPolling = () => {
  if (shouldPoll()) {
    if (timer) return;
    void poll();
    timer = setInterval(() => void poll(), POLL_MS);
    return;
  }
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};

export const registerBrowserTabs = () => {
  ipcMain.handle(APP_CHANNELS.browserTabsSubscribe, (event) => {
    const contents = event.sender;
    if (subscribers.has(contents)) return;
    subscribers.add(contents);
    contents.once("destroyed", () => {
      subscribers.delete(contents);
      syncPolling();
    });
    // A fresh subscriber has no tabs yet, so the change-detecting broadcast in
    // poll() would skip it if the set is unchanged. Push what we have first.
    lastSignature = "";
    syncPolling();
  });

  ipcMain.handle(APP_CHANNELS.browserTabsUnsubscribe, (event) => {
    subscribers.delete(event.sender);
    syncPolling();
  });

  ipcMain.handle(APP_CHANNELS.browserTabsFocus, (_event, ref: BrowserTabRef) =>
    focusBrowserTab(ref),
  );

  // Poll only while the app is in front: that's the only time the list is on
  // screen, and it keeps us off the CPU (and out of osascript) otherwise.
  app.on("browser-window-focus", syncPolling);
  // blur fires before the next window's focus, so re-check on the next tick
  // rather than tearing the timer down between two of our own windows.
  app.on("browser-window-blur", () => setImmediate(syncPolling));
};
