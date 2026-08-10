// ViewerSession — the contract every viewer engine implements, and the ONLY
// surface through which anything outside components/viewer/ may observe a
// reading session. Future agent tools (get_reading_session, get_selection,
// capture_node) are thin serialization wrappers over this interface; keep it
// engine-agnostic and additive.
import React from "react";

type ViewerKind = "web" | "reader" | "youtube" | "pdf";

// Selections carry surrounding context (W3C-annotation style) so future
// captures can re-anchor quotes after content is re-extracted.
export type ViewerSelection = {
  text: string;
  prefix: string;
  suffix: string;
};

export type ViewerState = {
  kind: ViewerKind;
  url: string;
  title: string;
  scroll?: { y: number; max: number };
  media?: { currentTime: number; duration: number; paused: boolean };
  page?: { current: number; total: number };
  selection: ViewerSelection | null;
};

export type ViewerEvent =
  | { type: "state"; state: ViewerState }
  | { type: "selection"; selection: ViewerSelection | null }
  | { type: "navigate"; url: string; title: string };

// Browser-style navigation, exposed only by engines that can honestly drive
// it (the Electron webview fully; the web-app iframe reload-only). The
// workspace header renders exactly the controls the active session offers.
type ViewerNav = {
  currentUrl(): string;
  canGoBack(): boolean;
  canGoForward(): boolean;
  goBack?(): void;
  goForward?(): void;
  reload(): void;
};

// PDF engine controls (custom pdf.js viewer). Scale "fit" tracks the stage
// width.
type ViewerPdfControls = {
  state(): { page: number; pageCount: number; scale: number | "fit" };
  goToPage(page: number): void;
  setScale(scale: number | "fit"): void;
};

export interface ViewerSession {
  readonly kind: ViewerKind;
  readonly itemId: string;
  getState(): Promise<ViewerState>;
  // What's on screen right now — the ephemeral context an agent would want.
  getVisibleText(): Promise<string>;
  getSelection(): Promise<ViewerSelection | null>;
  // Element-picker screenshot (webview engine only). Resolves null when the
  // user cancels the pick.
  captureNode?(): Promise<Blob | null>;
  // Rendered-DOM capture feeding the extraction pipeline (webview engine
  // only).
  extractContent?(): Promise<{
    html: string;
    url: string;
    title: string;
  } | null>;
  // Returns an unsubscribe function.
  on(listener: (event: ViewerEvent) => void): () => void;
  // Capability surfaces — present only where the engine supports them.
  readonly nav?: ViewerNav;
  readonly pdf?: ViewerPdfControls;
  // Future write-side (agent-driven): scrollTo, seekTo, highlightQuote —
  // additive, not implemented yet.
}

// Shared event plumbing for engine implementations.
export const createViewerEmitter = () => {
  const listeners = new Set<(event: ViewerEvent) => void>();
  return {
    emit: (event: ViewerEvent) => {
      for (const listener of listeners) listener(event);
    },
    on: (listener: (event: ViewerEvent) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

// Module-level registry so a future agent/MCP bridge can reach the live
// session without touching React. Observable so the workspace header (which
// renders before the engine mounts) can follow the active session.
let activeSession: ViewerSession | null = null;
const registryListeners = new Set<() => void>();

const getActiveViewerSession = (): ViewerSession | null => activeSession;

const setActiveSession = (session: ViewerSession | null) => {
  activeSession = session;
  for (const listener of registryListeners) listener();
};

const subscribeToRegistry = (listener: () => void) => {
  registryListeners.add(listener);
  return () => {
    registryListeners.delete(listener);
  };
};

// The currently mounted engine's session, as reactive state.
export const useActiveViewerSession = (): ViewerSession | null =>
  React.useSyncExternalStore(
    subscribeToRegistry,
    getActiveViewerSession,
    () => null,
  );

// Engines call this from an effect once their session is ready; it keeps the
// registry in sync with the mounted engine.
export const useRegisterViewerSession = (session: ViewerSession | null) => {
  React.useEffect(() => {
    if (!session) return;
    setActiveSession(session);
    return () => {
      if (activeSession === session) setActiveSession(null);
    };
  }, [session]);
};
