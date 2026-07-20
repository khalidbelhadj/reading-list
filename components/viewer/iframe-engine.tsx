// Web engine (browser fallback): the item's real page in an <iframe> pane.
// Sites that allow embedding render fully; sites that send
// frame-ancestors/X-Frame-Options show the browser's refusal inside the pane
// (not detectable from JS) — the header's open-in-browser action is the way
// out. The Electron app uses WebviewEngine (a real webview) instead — that
// one renders everything.
import React from "react";

import {
  createViewerEmitter,
  useRegisterViewerSession,
  type ViewerSession,
  type ViewerState,
} from "@/lib/viewer/session";

export const IframeEngine = ({
  itemId,
  url,
  title,
  markdown,
}: {
  itemId: string;
  url: string;
  title: string;
  markdown: string | null;
}) => {
  // Reload = remount the iframe; cross-origin history isn't scriptable.
  const [reloadKey, setReloadKey] = React.useState(0);

  const session = React.useMemo<ViewerSession>(() => {
    const emitter = createViewerEmitter();
    const getState = async (): Promise<ViewerState> => ({
      kind: "web",
      url,
      title,
      selection: null,
    });
    return {
      kind: "web",
      itemId,
      nav: {
        currentUrl: () => url,
        canGoBack: () => false,
        canGoForward: () => false,
        reload: () => setReloadKey((key) => key + 1),
      },
      getState,
      // Cross-origin iframe is opaque — extracted text is the best available
      // session context on this surface.
      getVisibleText: async () => markdown?.slice(0, 4000) ?? "",
      getSelection: async () => null,
      on: emitter.on,
    };
  }, [itemId, url, title, markdown]);

  useRegisterViewerSession(session);

  return (
    <iframe
      key={reloadKey}
      className="h-full w-full flex-1"
      src={url}
      title={title}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      referrerPolicy="no-referrer"
    />
  );
};
