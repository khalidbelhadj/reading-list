import React from "react";

// Mounted once near the app root (no-op outside the desktop app). The Electron
// app registers the readinglist:// protocol and forwards incoming links to the
// renderer via window.readingList.onDeepLink. The Chrome extension emits
// readinglist://item/<id> when "open in app" is enabled — translate it into the
// ?item= URL param that PanelLayout already reads, then fire popstate so the
// panel opens the item without a full reload.
export const DeepLinkItemWatcher = () => {
  React.useEffect(() => {
    if (typeof window === "undefined" || !window.readingList) return;
    return window.readingList.onDeepLink((url) => {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return;
      }
      // readinglist://item/<id>
      if (parsed.hostname !== "item") return;
      const id = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
      if (!id) return;
      const params = new URLSearchParams(window.location.search);
      if (params.get("item") === id) return;
      params.set("item", id);
      window.history.pushState(null, "", `?${params.toString()}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
  }, []);

  return null;
};
