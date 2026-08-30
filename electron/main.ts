import path from "node:path";

import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeTheme,
  shell,
} from "electron";

import { registerBrowserTabs } from "./browser-tabs";
import { APP_CHANNELS } from "./channels";

const DEV_URL = process.env.ELECTRON_DEV_URL ?? "http://localhost:3000";
const PROD_URL = "https://reading-list.khalidbelhadj.com";
const PROTOCOL = "readinglist";

// The dev server's port doubles as a per-instance id: each dev window targets
// its own port, so keying identity off the port lets arbitrarily many dev
// instances run side by side (separate userData, separate single-instance
// lock, separate window) with zero per-instance bookkeeping.
const devPort = (() => {
  try {
    return new URL(DEV_URL).port || "3000";
  } catch {
    return "3000";
  }
})();

// Chromium's DevTools Protocol listener, dev only — packaged builds never open
// it. It exposes the app's webContents as CDP targets, which is what lets
// tooling (scripts/electron-cdp.ts, chrome://inspect) inspect the real
// desktop UI instead of a browser tab.
//
// The port is derived from the dev port exactly like userData is, so parallel
// dev instances each get their own listener rather than fighting over 9222.
// ELECTRON_CDP_PORT pins a port; ELECTRON_CDP_PORT=off disables the listener.
const CDP_BASE_PORT = 9222;
const BASE_DEV_PORT = 3000;
const cdpPort = (() => {
  if (app.isPackaged) return null;
  const explicit = process.env.ELECTRON_CDP_PORT;
  if (explicit === "off") return null;
  const port = explicit
    ? Number(explicit)
    : CDP_BASE_PORT + (Number(devPort) - BASE_DEV_PORT);
  return Number.isFinite(port) && port > 0 ? port : null;
})();

if (cdpPort !== null) {
  app.commandLine.appendSwitch("remote-debugging-port", String(cdpPort));
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
  console.log(`[electron] CDP listening on http://127.0.0.1:${cdpPort}`);
}

// Hostnames the renderer is allowed to navigate to. Anything else gets pushed
// to the system browser so the desktop window only ever shows our own app.
const APP_HOSTS = new Set(["reading-list.khalidbelhadj.com", "localhost"]);
const isAppNavigation = (url: string) => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "about:" || parsed.protocol === "data:")
      return true;
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
      return false;
    return APP_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
};

// Resolve icon paths relative to the project root regardless of where the
// compiled main.js lives (dist-electron/ in dev, resources/app/ when packaged).
const iconPath = (file: string) =>
  path.join(app.getAppPath(), "electron", "assets", file);

let mainWindow: BrowserWindow | null = null;
let pendingDeepLink: string | null = null;

// Traffic-light geometry. The native macOS window buttons are a fixed physical
// size and don't scale with the renderer's page zoom, so we move them ourselves
// to track the (zoom-scaled) toolbar content. The toolbar scales about the
// top-left origin, so a content point at inset I (at zoom 1) sits at I*zoom when
// zoomed. To keep the dot's *center* on that point — without the dot itself
// growing — the top-left inset is (BASE + RADIUS)*zoom - RADIUS: the radius is
// scaled into the anchor, then subtracted back so it stays a fixed offset.
// At zoom 1 this is exactly BASE (18), matching the tuned default. The CSS
// toolbar clearance in globals.css mirrors this with the same coefficients.
const BASE_TRAFFIC_LIGHT_INSET = 18;
const TRAFFIC_LIGHT_RADIUS = 6;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_RATIO = 1.2;
let zoomFactor = 1;

const clampZoom = (value: number) =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

const trafficLightInset = (zoom: number) =>
  Math.round(
    (BASE_TRAFFIC_LIGHT_INSET + TRAFFIC_LIGHT_RADIUS) * zoom -
      TRAFFIC_LIGHT_RADIUS,
  );

// Single source of truth for zoom. Applies the factor to the page, repositions
// the traffic lights to track the scaled content, and tells the renderer so its
// CSS can widen the toolbar's left clearance (gap = clearance / zoom).
const applyZoomToWindow = (win: BrowserWindow) => {
  win.webContents.setZoomFactor(zoomFactor);
  if (process.platform === "darwin") {
    const inset = trafficLightInset(zoomFactor);
    win.setWindowButtonPosition({ x: inset, y: inset });
  }
  win.webContents.send(APP_CHANNELS.zoom, zoomFactor);
};

const setZoom = (next: number) => {
  zoomFactor = clampZoom(next);
  BrowserWindow.getAllWindows().forEach(applyZoomToWindow);
};

// Approximations of --background tokens from app/globals.css. Used as the
// window background color so fast resizes don't expose a white (or dark)
// strip that mismatches the page until React paints.
const LIGHT_BG = "#fcfbf9";
const DARK_BG = "#1a1a17";
const themeBg = () => (nativeTheme.shouldUseDarkColors ? DARK_BG : LIGHT_BG);

const sendDeepLink = (url: string) => {
  if (mainWindow && !mainWindow.webContents.isLoading()) {
    mainWindow.webContents.send(APP_CHANNELS.deepLink, url);
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  } else {
    pendingDeepLink = url;
    if (mainWindow) mainWindow.focus();
  }
};

const sharedWebPreferences = () => ({
  preload: path.join(__dirname, "preload.js"),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
});

// Per-webContents wiring for the main window. Registered globally via
// app.on("web-contents-created") so any window gets the exact same
// navigation guards, zoom handling, and dev title stamp.
const attachWindowBehavior = (contents: Electron.WebContents) => {
  // window.open() always goes to the system browser — the app is a single
  // window.
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Block any in-renderer navigation that leaves the app's own origin and push
  // it to the system browser. Covers Google OAuth, third-party links the user
  // might click, and any redirect chain that tries to escape.
  contents.on("will-navigate", (event, url) => {
    if (!isAppNavigation(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Same guard for full document redirects (e.g. server-side 302s).
  contents.on("will-redirect", (event, url) => {
    if (!isAppNavigation(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Re-assert zoom after every (re)load: setZoomFactor resets to 1 on
  // navigation, and the freshly mounted renderer needs the current factor to
  // size its toolbar clearance.
  contents.on("did-finish-load", () => {
    const win = BrowserWindow.fromWebContents(contents);
    if (win) applyZoomToWindow(win);
  });

  // Ctrl/Cmd + mouse-wheel zoom. We own the zoom factor, so step it ourselves
  // and let setZoom reposition the buttons and notify the renderers.
  contents.on("zoom-changed", (_event, direction) => {
    setZoom(zoomFactor * (direction === "in" ? ZOOM_RATIO : 1 / ZOOM_RATIO));
  });

  // In dev, stamp the port into the window title so multiple instances are
  // tellable apart in the dock / window switcher. The page sets its own
  // <title>, so re-append on every page-title-updated.
  if (!app.isPackaged) {
    contents.on("page-title-updated", (event, title) => {
      event.preventDefault();
      BrowserWindow.fromWebContents(contents)?.setTitle(
        `${title} — :${devPort}`,
      );
    });
  }
};

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 400,
    minHeight: 400,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: {
      x: BASE_TRAFFIC_LIGHT_INSET,
      y: BASE_TRAFFIC_LIGHT_INSET,
    },
    backgroundColor: themeBg(),
    icon: iconPath("icon.png"),
    webPreferences: sharedWebPreferences(),
  });

  mainWindow.webContents.on("did-finish-load", () => {
    if (pendingDeepLink && mainWindow) {
      mainWindow.webContents.send(APP_CHANNELS.deepLink, pendingDeepLink);
      pendingDeepLink = null;
    }
  });

  const url = app.isPackaged ? PROD_URL : DEV_URL;
  mainWindow.loadURL(url);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
};

// Use a distinct identity in dev so the dev Electron and the packaged app
// don't share a userData dir (which would also share the single-instance
// lock — launching the packaged app while dev is running would otherwise
// trigger requestSingleInstanceLock() === false and silently quit).
//
// The name is further suffixed with the dev port, so two dev instances on
// different ports get distinct userData dirs and therefore distinct
// single-instance locks. Without this, the second `electron .` would fail
// requestSingleInstanceLock() and merely refocus the first window instead of
// opening its own. As a bonus, each instance gets isolated cookies/localStorage.
if (app.isPackaged) {
  app.setName("Reading List");
} else {
  const devName = `Reading List Dev ${devPort}`;
  app.setName(devName);
  app.setPath("userData", path.join(app.getPath("appData"), devName));
}

// Custom protocol registration. macOS dispatches via open-url; Windows/Linux
// pass the URL as a process argument and we forward via the single-instance lock.
const appEntryArg = process.argv[1];
if (process.defaultApp && appEntryArg !== undefined) {
  app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [
    path.resolve(appEntryArg),
  ]);
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    const url = argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
    if (url) sendDeepLink(url);
  });

  app.on("open-url", (event, url) => {
    event.preventDefault();
    sendDeepLink(url);
  });

  // Guards + zoom + dev title for every window.
  app.on("web-contents-created", (_event, contents) => {
    attachWindowBehavior(contents);
  });

  ipcMain.handle(APP_CHANNELS.openExternal, (_event, url: string) =>
    shell.openExternal(url),
  );

  // Renderer reads the current zoom on mount so its toolbar clearance is
  // correct even if it remounts (HMR) after the last "zoom" broadcast.
  ipcMain.handle(APP_CHANNELS.zoomCurrent, () => zoomFactor);

  // Windows showing a translucent layout (the app shell) keep a
  // clear background so the desktop shows through the vibrancy; a theme flip
  // must not paint them opaque again.
  const vibrantWindows = new WeakSet<BrowserWindow>();
  // The vibrancy material takes its light/dark look from the native
  // appearance, not from the page, so a dark app over a light desktop would
  // get a light frosted sidebar with light text on it. While a window is
  // translucent, pin the native appearance to the app's theme; release it to
  // the OS when the translucent layout goes away.
  ipcMain.handle(
    APP_CHANNELS.setVibrancy,
    (event, enabled: boolean, appearance?: "light" | "dark") => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) return;
      if (enabled) {
        vibrantWindows.add(win);
        nativeTheme.themeSource = appearance ?? "system";
        win.setVibrancy("sidebar");
        win.setBackgroundColor("#00000000");
      } else {
        vibrantWindows.delete(win);
        nativeTheme.themeSource = "system";
        win.setVibrancy(null);
        win.setBackgroundColor(themeBg());
      }
    },
  );

  // Keep each window's background color in sync with the OS appearance so
  // resizes don't flash (vibrant windows stay clear — see setVibrancy).
  nativeTheme.on("updated", () => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!vibrantWindows.has(win)) win.setBackgroundColor(themeBg());
    }
  });

  app.whenReady().then(() => {
    if (process.platform === "darwin") {
      app.dock?.setIcon(iconPath("icon.png"));
    }

    // Browser-tab visibility: polls local browsers while a renderer is
    // subscribed and a window is focused (see electron/browser-tabs.ts).
    registerBrowserTabs();

    // Custom menu so the zoom shortcuts route through setZoom (which also
    // repositions the traffic lights). Everything else reuses Electron's
    // built-in role submenus, so the standard items are unchanged.
    const isMac = process.platform === "darwin";
    const menu = Menu.buildFromTemplate([
      ...(isMac
        ? ([{ role: "appMenu" }] as Electron.MenuItemConstructorOptions[])
        : []),
      { role: "fileMenu" },
      { role: "editMenu" },
      {
        label: "View",
        submenu: [
          { role: "reload" },
          { role: "forceReload" },
          { role: "toggleDevTools" },
          { type: "separator" },
          {
            label: "Actual Size",
            accelerator: "CmdOrCtrl+0",
            click: () => setZoom(1),
          },
          {
            label: "Zoom In",
            accelerator: "CmdOrCtrl+Plus",
            click: () => setZoom(zoomFactor * ZOOM_RATIO),
          },
          {
            // Cmd/Ctrl + "=" (the unshifted key) also zooms in. A second
            // hidden item carries that accelerator since a menu item only
            // binds one.
            label: "Zoom In",
            accelerator: "CmdOrCtrl+=",
            visible: false,
            acceleratorWorksWhenHidden: true,
            click: () => setZoom(zoomFactor * ZOOM_RATIO),
          },
          {
            label: "Zoom Out",
            accelerator: "CmdOrCtrl+-",
            click: () => setZoom(zoomFactor / ZOOM_RATIO),
          },
          { type: "separator" },
          { role: "togglefullscreen" },
        ],
      },
      { role: "windowMenu" },
    ]);
    Menu.setApplicationMenu(menu);

    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
