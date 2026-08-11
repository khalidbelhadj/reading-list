// Per-webContents wiring: navigation guards, webview hardening, zoom re-assert
// and the dev title stamp.
//
// This is registered globally via app.on("web-contents-created") and is the
// ONLY thing that wires the main window — attachWindowBehavior is never called
// on it directly. Register it before app-ready / window creation, or the main
// window silently loses all of the below while child windows keep working.
import { app, BrowserWindow, shell } from "electron";

import { devPort, isDev, viewerPreloadPath } from "./env";
import { childWindowOptions } from "./windows";
import { applyZoomToWindow, getZoomFactor, setZoom, ZOOM_RATIO } from "./zoom";

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

// Viewer <webview> guests host third-party pages: window.open and any
// escape-hatch navigation goes to the system browser; the guest itself may
// browse http(s) freely (it IS a browser pane).
const attachViewerWebviewBehavior = (contents: Electron.WebContents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  contents.on("will-navigate", (event, url) => {
    if (!/^https?:/i.test(url)) event.preventDefault();
  });
};

// Shared by the main window and any secondary windows the renderer opens (item
// windows, review windows), so child windows get the exact same navigation
// guards, zoom handling, and dev title stamp as the main window.
const attachWindowBehavior = (contents: Electron.WebContents) => {
  // Enforce guest hardening no matter what attributes the renderer put on
  // the <webview> tag: our preload, no node, sandboxed, isolated session.
  contents.on("will-attach-webview", (_event, webPreferences) => {
    webPreferences.preload = viewerPreloadPath();
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
    // Chromium's built-in PDF viewer (PDFium), for live guest pages that
    // navigate to a raw PDF URL. A guest doesn't inherit the embedder's
    // webPreferences, so it has to be set here rather than on the host window.
    // (The app's own PDF pane renders via pdf.js, not this.)
    webPreferences.plugins = true;
  });

  // window.open() — app-origin URLs become real child windows (keeping their
  // window.opener link back to the parent, which the renderer uses to hand
  // items back to the originating window); everything else goes to the
  // system browser.
  contents.setWindowOpenHandler(({ url }) => {
    if (isAppNavigation(url)) {
      let isItemWindow = false;
      try {
        isItemWindow = new URL(url).searchParams.get("window") != null;
      } catch {}
      return {
        action: "allow",
        overrideBrowserWindowOptions: childWindowOptions(isItemWindow),
      };
    }
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
    setZoom(
      getZoomFactor() * (direction === "in" ? ZOOM_RATIO : 1 / ZOOM_RATIO),
    );
  });

  // In dev, stamp the port into the window title so multiple instances are
  // tellable apart in the dock / window switcher. The page sets its own
  // <title>, so re-append on every page-title-updated.
  if (isDev) {
    contents.on("page-title-updated", (event, title) => {
      event.preventDefault();
      BrowserWindow.fromWebContents(contents)?.setTitle(
        `${title} — :${devPort}`,
      );
    });
  }
};

/**
 * Guards + zoom + dev title for every window, including child windows the
 * renderer opens via window.open (which never pass through createMainWindow).
 * Viewer webview guests get browser-pane behavior instead — the app-origin
 * navigation guard would otherwise eject every embedded page to the system
 * browser.
 */
export const registerWebContentsCreated = () => {
  app.on("web-contents-created", (_event, contents) => {
    if (contents.getType() === "webview") {
      attachViewerWebviewBehavior(contents);
      return;
    }
    attachWindowBehavior(contents);
  });
};
