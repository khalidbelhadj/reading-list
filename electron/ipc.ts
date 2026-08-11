// ipcMain handlers for the invoke channels in APP_CHANNELS. Registered once,
// inside the single-instance-lock branch — re-registering a channel throws.
import { BrowserWindow, ipcMain, nativeTheme, shell } from "electron";

import { APP_CHANNELS } from "./channels";
import { getZoomFactor } from "./zoom";

export const registerIpcHandlers = () => {
  ipcMain.handle(APP_CHANNELS.openExternal, (_event, url: string) =>
    shell.openExternal(url),
  );

  // Raise the calling window. Used when a secondary window hands an item back
  // to the window that opened it — the renderer can't focus a window itself.
  ipcMain.handle(APP_CHANNELS.focusWindow, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  // Renderer reads the current zoom on mount so its toolbar clearance is
  // correct even if it remounts (HMR) after the last "zoom" broadcast.
  ipcMain.handle(APP_CHANNELS.zoomCurrent, () => getZoomFactor());

  ipcMain.handle(
    APP_CHANNELS.nativeThemeCurrent,
    () => nativeTheme.shouldUseDarkColors,
  );
};
