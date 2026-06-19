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
