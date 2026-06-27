import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeTheme,
  shell,
} from "electron";
import path from "node:path";

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
const setZoom = (next: number) => {
  if (!mainWindow) return;
  zoomFactor = clampZoom(next);
  mainWindow.webContents.setZoomFactor(zoomFactor);
  if (process.platform === "darwin") {
    const inset = trafficLightInset(zoomFactor);
    mainWindow.setWindowButtonPosition({ x: inset, y: inset });
  }
  mainWindow.webContents.send("zoom", zoomFactor);
};

// Approximations of --background tokens from app/globals.css. Used as the
// window background color so fast resizes don't expose a white (or dark)
// strip that mismatches the page until React paints.
const LIGHT_BG = "#fcfbf9";
const DARK_BG = "#1a1a17";
const themeBg = () => (nativeTheme.shouldUseDarkColors ? DARK_BG : LIGHT_BG);

const sendDeepLink = (url: string) => {
  if (mainWindow && !mainWindow.webContents.isLoading()) {
    mainWindow.webContents.send("deep-link", url);
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  } else {
    pendingDeepLink = url;
    if (mainWindow) mainWindow.focus();
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
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // window.open() — only allow app URLs as actual new windows (we don't create
  // any), everything else goes to the system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isAppNavigation(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  // Block any in-renderer navigation that leaves the app's own origin and push
  // it to the system browser. Covers Google OAuth, third-party links the user
  // might click, and any redirect chain that tries to escape.
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isAppNavigation(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Same guard for full document redirects (e.g. server-side 302s).
  mainWindow.webContents.on("will-redirect", (event, url) => {
    if (!isAppNavigation(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.webContents.on("did-finish-load", () => {
    if (pendingDeepLink && mainWindow) {
      mainWindow.webContents.send("deep-link", pendingDeepLink);
      pendingDeepLink = null;
    }
    // Re-assert zoom after every (re)load: setZoomFactor resets to 1 on
    // navigation, and the freshly mounted renderer needs the current factor to
    // size its toolbar clearance.
    setZoom(zoomFactor);
  });

  // Ctrl/Cmd + mouse-wheel zoom. We own the zoom factor, so step it ourselves
  // and let setZoom reposition the buttons and notify the renderer.
  mainWindow.webContents.on("zoom-changed", (_event, direction) => {
    setZoom(zoomFactor * (direction === "in" ? ZOOM_RATIO : 1 / ZOOM_RATIO));
  });

  // In dev, stamp the port into the window title so multiple instances are
  // tellable apart in the dock / window switcher. The page sets its own
  // <title>, so re-append on every page-title-updated.
  if (!app.isPackaged) {
    mainWindow.webContents.on("page-title-updated", (event, title) => {
      event.preventDefault();
      mainWindow?.setTitle(`${title} — :${devPort}`);
    });
  }

  const url = app.isPackaged ? PROD_URL : DEV_URL;
  mainWindow.loadURL(url);

  const onThemeUpdate = () => {
    mainWindow?.setBackgroundColor(themeBg());
  };
  nativeTheme.on("updated", onThemeUpdate);

  mainWindow.on("closed", () => {
    nativeTheme.off("updated", onThemeUpdate);
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
if (process.defaultApp && process.argv.length >= 2) {
  app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [
    path.resolve(process.argv[1]),
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

  ipcMain.handle("open-external", (_event, url: string) =>
    shell.openExternal(url),
  );

  // Renderer reads the current zoom on mount so its toolbar clearance is
  // correct even if it remounts (HMR) after the last "zoom" broadcast.
  ipcMain.handle("zoom-current", () => zoomFactor);

  // Chromium's matchMedia("(prefers-color-scheme: dark)") doesn't fire its
  // "change" listener when the macOS appearance flips while the app is
  // running. nativeTheme.on("updated", ...) is the authoritative signal —
  // forward it to the renderer so the theme follows the OS live.
  ipcMain.handle("native-theme-current", () => nativeTheme.shouldUseDarkColors);
  nativeTheme.on("updated", () => {
    if (mainWindow) {
      mainWindow.webContents.send(
        "native-theme",
        nativeTheme.shouldUseDarkColors,
      );
    }
  });

  app.whenReady().then(() => {
    if (process.platform === "darwin") {
      app.dock?.setIcon(iconPath("icon.png"));
    }

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
