// Chromium's DevTools Protocol listener, dev only — packaged builds never open
// it. It exposes *every* webContents this app creates as its own CDP target:
// the main window, each secondary item/review window, and the viewer <webview>
// guests. That's what lets tooling (scripts/electron-cdp.ts, chrome://inspect)
// inspect the real desktop UI, windows and all, instead of a browser tab.
import { app } from "electron";

import { devPort, isDev } from "./env";

// The port is derived from the dev port exactly like userData is, so parallel
// dev instances each get their own listener rather than fighting over 9222.
// ELECTRON_CDP_PORT pins a port; ELECTRON_CDP_PORT=off disables the listener.
const CDP_BASE_PORT = 9222;
const BASE_DEV_PORT = 3000;

const cdpPort = () => {
  if (!isDev) return null;
  const explicit = process.env.ELECTRON_CDP_PORT;
  if (explicit === "off") return null;
  const port = explicit
    ? Number(explicit)
    : CDP_BASE_PORT + (Number(devPort) - BASE_DEV_PORT);
  return Number.isFinite(port) && port > 0 ? port : null;
};

/**
 * Must be called before Chromium starts — `appendSwitch` is a no-op once the
 * process is up, so this is the first statement of main.ts.
 */
export const enableCdpListener = () => {
  const port = cdpPort();
  if (port === null) return;

  app.commandLine.appendSwitch("remote-debugging-port", String(port));
  // chrome://inspect's DevTools frontend connects with a devtools:// origin;
  // Chromium rejects non-allowlisted origins on the debugger socket.
  app.commandLine.appendSwitch("remote-allow-origins", "devtools://devtools");
  // Chromium throttles — and eventually freezes — renderers in occluded or
  // backgrounded windows. Anything driving the app over CDP never focuses it,
  // so without these the window being inspected stops running rAF and timers
  // and reads as hung. The flip side: background throttling bugs won't
  // reproduce while the listener is on.
  app.commandLine.appendSwitch("disable-renderer-backgrounding");
  app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
  console.log(`[electron] CDP listening on http://127.0.0.1:${port}`);
};
