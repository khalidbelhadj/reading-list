// Main-process boot sequence. Everything substantive lives in a sibling
// module; this file exists to run them in the one order that works.
//
// The ordering constraints are real, and each has a failure mode whose symptom
// is far from its cause:
//
//   enableCdpListener()      before Chromium starts (appendSwitch is a no-op
//                            afterwards)
//   configureAppIdentity()   before the single-instance lock (the lock file
//                            lives inside userData)
//   registerWebContentsCreated()
//                            before any window exists — it is the only thing
//                            that wires the main window
//   watchNativeTheme()       before ready, so a startup appearance flip isn't
//                            missed
import { app, BrowserWindow } from "electron";

import { configureAppIdentity, registerProtocolClient } from "./app-identity";
import { registerBrowserTabs } from "./browser-tabs";
import { enableCdpListener } from "./cdp";
import { deliverDeepLink } from "./deep-links";
import { iconPath, PROTOCOL } from "./env";
import { registerIpcHandlers } from "./ipc";
import { installAppMenu } from "./menu";
import { watchNativeTheme } from "./theme";
import { registerWebContentsCreated } from "./web-contents";
import { createMainWindow, getMainWindow } from "./windows";

enableCdpListener();
configureAppIdentity();
registerProtocolClient();

const bootstrap = () => {
  app.on("second-instance", (_event, argv) => {
    const win = getMainWindow();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
    const url = argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
    if (url) deliverDeepLink(win, url);
  });

  app.on("open-url", (event, url) => {
    event.preventDefault();
    deliverDeepLink(getMainWindow(), url);
  });

  registerWebContentsCreated();
  registerIpcHandlers();
  // Open-browser-tab visibility: IPC + focus-gated polling. Idle until a
  // renderer subscribes.
  registerBrowserTabs();
  watchNativeTheme();

  app.whenReady().then(() => {
    if (process.platform === "darwin") {
      app.dock?.setIcon(iconPath("icon.png"));
    }

    installAppMenu();
    createMainWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });
};

// A second instance hands its argv to the first via second-instance and quits.
if (app.requestSingleInstanceLock()) bootstrap();
else app.quit();

// Deliberately outside the lock branch: an instance that never booted still
// needs the non-macOS quit-on-last-window behavior.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
