// Webview engine (Electron only): the literal browser pane — an Electron
// <webview> showing the item's actual page. The main process enforces guest
// hardening (viewer-preload, sandbox, no node) via will-attach-webview, and
// gives guests browser-pane navigation behavior.
//
// This engine is also a content *producer*: once the page settles, the
// rendered DOM is captured and submitted to the extraction pipeline
// (submitLiveContent), which beats server-side fetch on paywalled/JS-heavy
// pages because it sees exactly what the user's session rendered.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React from "react";

import { submitLiveContent } from "@/app/actions";
import { VIEWER_CHANNELS, type ViewerRpcMethod } from "@/electron/channels";
import { normalizeUrl } from "@/lib/url";
import {
  createViewerEmitter,
  useRegisterViewerSession,
  type ViewerSelection,
  type ViewerSession,
  type ViewerState,
} from "@/lib/viewer/session";

const RPC_TIMEOUT_MS = 5000;
// Let client-side rendering/hydration settle before capturing the DOM.
const CAPTURE_SETTLE_MS = 3500;

type PreloadState = {
  url: string;
  title: string;
  scroll?: { y: number; max: number };
  selection: ViewerSelection | null;
};

const dataUrlToBlob = (dataUrl: string): Blob | null => {
  const match = dataUrl.match(/^data:(.+?);base64,(.*)$/);
  if (!match?.[1] || match[2] === undefined) return null;
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: match[1] });
};

export const WebviewEngine = ({
  itemId,
  url,
  title,
}: {
  itemId: string;
  url: string;
  title: string;
}) => {
  const queryClient = useQueryClient();
  const webviewRef = React.useRef<WebviewElement>(null);
  const rpcIdRef = React.useRef(0);
  const pendingRef = React.useRef(new Map<number, (result: unknown) => void>());
  const pickerResolveRef = React.useRef<
    ((picked: { rect: WebviewRect | null; text: string }) => void) | null
  >(null);
  const capturedRef = React.useRef(false);
  const emitterRef = React.useRef(createViewerEmitter());

  const rpc = React.useCallback(
    <T,>(method: ViewerRpcMethod): Promise<T | null> => {
      const webview = webviewRef.current;
      if (!webview) return Promise.resolve(null);
      const id = ++rpcIdRef.current;
      return new Promise<T | null>((resolve) => {
        const timeout = setTimeout(() => {
          pendingRef.current.delete(id);
          resolve(null);
        }, RPC_TIMEOUT_MS);
        pendingRef.current.set(id, (result) => {
          clearTimeout(timeout);
          resolve(result as T);
        });
        void webview.send(VIEWER_CHANNELS.request, { id, method });
      });
    },
    [],
  );

  const { mutate: submitCapture } = useMutation({
    mutationFn: (capture: { url: string; title: string; html: string }) =>
      submitLiveContent({ itemId, ...capture }),
    onSuccess: (result) => {
      if (!result.ok) return;
      // Only this item's content changed; the intelligence overview is a
      // single aggregate query, so that one is invalidated whole.
      void queryClient.invalidateQueries({
        queryKey: ["item-content", itemId],
      });
      void queryClient.invalidateQueries({ queryKey: ["intelligence"] });
    },
  });

  // Guest ↔ host plumbing: RPC responses, pushed events, node-picker results,
  // and the once-per-mount live capture after the page settles.
  React.useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const onIpcMessage = (event: Event) => {
      const message = event as WebviewIpcMessageEvent;
      if (message.channel === VIEWER_CHANNELS.response) {
        const payload = message.args[0] as { id: number; result: unknown };
        pendingRef.current.get(payload.id)?.(payload.result);
        pendingRef.current.delete(payload.id);
      } else if (message.channel === VIEWER_CHANNELS.nodePicked) {
        const payload = message.args[0] as {
          rect: WebviewRect | null;
          text: string;
        };
        pickerResolveRef.current?.(payload);
        pickerResolveRef.current = null;
      }
    };

    const emitNavigate = () => {
      emitterRef.current.emit({
        type: "navigate",
        url: webview.getURL(),
        title: webview.getTitle(),
      });
    };

    let captureTimer: ReturnType<typeof setTimeout> | null = null;
    const onFinishLoad = () => {
      emitNavigate();
      // Live capture: only the item's own page, once per mount.
      if (capturedRef.current) return;
      if (normalizeUrl(webview.getURL()) !== normalizeUrl(url)) return;
      // A second did-finish-load before the settle window elapses restarts
      // the timer — clear the old one so it can't double-run the extract.
      if (captureTimer) clearTimeout(captureTimer);
      captureTimer = setTimeout(() => {
        void rpc<{ html: string; url: string; title: string }>("extract").then(
          (extracted) => {
            if (!extracted || capturedRef.current) return;
            capturedRef.current = true;
            submitCapture(extracted);
          },
        );
      }, CAPTURE_SETTLE_MS);
    };

    webview.addEventListener("ipc-message", onIpcMessage);
    webview.addEventListener("did-finish-load", onFinishLoad);
    // Keep the header's URL readout + back/forward state current while the
    // user browses inside the pane.
    webview.addEventListener("did-navigate", emitNavigate);
    webview.addEventListener("did-navigate-in-page", emitNavigate);
    return () => {
      webview.removeEventListener("ipc-message", onIpcMessage);
      webview.removeEventListener("did-finish-load", onFinishLoad);
      webview.removeEventListener("did-navigate", emitNavigate);
      webview.removeEventListener("did-navigate-in-page", emitNavigate);
      if (captureTimer) clearTimeout(captureTimer);
    };
  }, [url, rpc, submitCapture]);

  const session = React.useMemo<ViewerSession>(() => {
    // Webview methods throw before the guest attaches — treat as defaults.
    const safe = <T,>(read: (webview: WebviewElement) => T, fallback: T): T => {
      const webview = webviewRef.current;
      if (!webview) return fallback;
      try {
        return read(webview);
      } catch {
        return fallback;
      }
    };
    return {
      kind: "web",
      itemId,
      nav: {
        currentUrl: () => safe((w) => w.getURL(), url),
        canGoBack: () => safe((w) => w.canGoBack(), false),
        canGoForward: () => safe((w) => w.canGoForward(), false),
        goBack: () => safe((w) => w.goBack(), undefined),
        goForward: () => safe((w) => w.goForward(), undefined),
        reload: () => safe((w) => w.reload(), undefined),
      },
      getState: async (): Promise<ViewerState> => {
        const state = await rpc<PreloadState>("getState");
        return {
          kind: "web",
          url: state?.url ?? webviewRef.current?.getURL() ?? url,
          title: state?.title ?? title,
          scroll: state?.scroll,
          selection: state?.selection ?? null,
        };
      },
      getVisibleText: async () => (await rpc<string>("getVisibleText")) ?? "",
      getSelection: async () =>
        (await rpc<ViewerSelection | null>("getSelection")) ?? null,
      captureNode: async () => {
        const webview = webviewRef.current;
        if (!webview) return null;
        const picked = await new Promise<{
          rect: WebviewRect | null;
          text: string;
        }>((resolve) => {
          pickerResolveRef.current = resolve;
          void rpc("startNodePicker");
        });
        if (!picked.rect) return null;
        const image = await webview.capturePage(picked.rect);
        return dataUrlToBlob(image.toDataURL());
      },
      extractContent: async () =>
        rpc<{ html: string; url: string; title: string }>("extract"),
      on: emitterRef.current.on,
    };
  }, [itemId, url, title, rpc]);

  useRegisterViewerSession(session);

  return (
    <webview
      ref={webviewRef}
      src={url}
      partition="persist:viewer"
      className="h-full w-full flex-1"
    />
  );
};
