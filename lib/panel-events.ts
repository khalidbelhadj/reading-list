// A tiny event bus for driving the item panel's view transitions from
// keyboard shortcuts. The panel owns the phase state machine (closed ↔ side ↔
// fullw) but the shortcuts live in the central keyboard handler, which is a
// sibling component — so they dispatch a command and the panel actuates it.
//
//   expand   — step toward more screen:  side → fullw
//   collapse — step toward less screen:  fullw → side → closed
//   peek     — ensure the list is visible: fullw → side (never closes)
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
const READ_EVENT = "rl:read-item";

export const dispatchReadItem = (itemId: string): void => {
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
