import { app, BrowserWindow, ipcMain, nativeTheme, shell } from "electron";
import path from "node:path";

const DEV_URL = process.env.ELECTRON_DEV_URL ?? "http://localhost:3000";
const PROD_URL = "https://reading-list.khalidbelhadj.com";
const PROTOCOL = "readinglist";

// Hostnames the renderer is allowed to navigate to. Anything else gets pushed
// to the system browser so the desktop window only ever shows our own app.
const APP_HOSTS = new Set(["reading-list.khalidbelhadj.com", "localhost"]);
const isAppNavigation = (url: string) => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "about:" || parsed.protocol === "data:") return true;
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
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

// Approximations of --background tokens from app/globals.css. Used as the
// window background color so fast resizes don't expose a white (or dark)
// strip that mismatches the page until React paints.
const LIGHT_BG = "#fcfbf9";
const DARK_BG = "#1a1a17";
const themeBg = () => (nativeTheme.shouldUseDarkColors ? DARK_BG : LIGHT_BG);

const sendDeepLink = (url: string) => {
  if (mainWindow && !mainWindow.webContents.isLoading()) {
    mainWindow.webContents.send("deep-link", url);
  } else {
    pendingDeepLink = url;
    if (mainWindow) mainWindow.focus();
  }
};

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 18, y: 18 },
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
  });

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
if (app.isPackaged) {
  app.setName("Reading List");
} else {
  app.setName("Reading List Dev");
  app.setPath("userData", path.join(app.getPath("appData"), "Reading List Dev"));
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

  ipcMain.handle("open-external", (_event, url: string) => shell.openExternal(url));

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
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
