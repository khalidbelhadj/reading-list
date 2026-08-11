// The application menu. Custom only so the zoom shortcuts route through
// setZoom (which also repositions the traffic lights); everything else reuses
// Electron's built-in role submenus, so the standard items are unchanged.
import { Menu } from "electron";

import { getZoomFactor, setZoom, ZOOM_RATIO } from "./zoom";

export const installAppMenu = () => {
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
          click: () => setZoom(getZoomFactor() * ZOOM_RATIO),
        },
        {
          // Cmd/Ctrl + "=" (the unshifted key) also zooms in. A second
          // hidden item carries that accelerator since a menu item only
          // binds one.
          label: "Zoom In",
          accelerator: "CmdOrCtrl+=",
          visible: false,
          acceleratorWorksWhenHidden: true,
          click: () => setZoom(getZoomFactor() * ZOOM_RATIO),
        },
        {
          label: "Zoom Out",
          accelerator: "CmdOrCtrl+-",
          click: () => setZoom(getZoomFactor() / ZOOM_RATIO),
        },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
  ]);
  Menu.setApplicationMenu(menu);
};
