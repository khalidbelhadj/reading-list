import React from "react";

import { openItemInPanel, parseOpenItemMessage } from "@/lib/app-windows";

// Mounted once near the app root. Secondary windows (review windows, item
// windows) route "show this item" requests back to the window that opened
// them via window.opener.postMessage — this watcher receives them, opens the
// item in the panel, and (in Electron) raises this window via IPC, which a
// renderer can't do on its own.
export const WindowMessageWatcher = () => {
  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const itemId = parseOpenItemMessage(event.data);
      if (!itemId) return;
      openItemInPanel(itemId);
      window.readingList?.focusWindow();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return null;
};
