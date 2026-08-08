// A tiny event bus for driving the item panel's view transitions from
// keyboard shortcuts. The panel owns the phase state machine (closed ↔ side ↔
// fullw) but the shortcuts live in the central keyboard handler, which is a
// sibling component — so they dispatch a command and the panel actuates it.
//
//   expand   — step toward more screen:  side → fullw
//   collapse — step toward less screen:  fullw → side → closed
//   peek     — ensure the list is visible: fullw → side (never closes)
import { isElectron } from "@/lib/platform";

export type PanelCommand = "expand" | "collapse" | "peek";

const EVENT = "rl:panel-command";

export const dispatchPanelCommand = (command: PanelCommand): void => {
  window.dispatchEvent(
    new CustomEvent<PanelCommand>(EVENT, { detail: command }),
  );
};

export const subscribePanelCommand = (
  handler: (command: PanelCommand) => void,
): (() => void) => {
  const listener = (event: Event) => {
    handler((event as CustomEvent<PanelCommand>).detail);
  };
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
};

// "Read in app" — opens the reading panel for an item. Dispatched from the
// item menu (deep in the list tree), actuated by PanelLayout, which owns the
// reading-panel state.
//
// Desktop-only: the mini browser is Electron's <webview>, and the PDF and
// video engines lean on the shell too (native zoom, live capture). The web
// app offers "Open in desktop app" instead. This is the single choke point
// for opening the reader interactively — the menu item is hidden on the web
// as well, and PanelLayout ignores a ?read= deep link there.
const READ_EVENT = "rl:read-item";

export const dispatchReadItem = (itemId: string): void => {
  if (!isElectron()) return;
  window.dispatchEvent(new CustomEvent<string>(READ_EVENT, { detail: itemId }));
};

export const subscribeReadItem = (
  handler: (itemId: string) => void,
): (() => void) => {
  const listener = (event: Event) => {
    handler((event as CustomEvent<string>).detail);
  };
  window.addEventListener(READ_EVENT, listener);
  return () => window.removeEventListener(READ_EVENT, listener);
};
