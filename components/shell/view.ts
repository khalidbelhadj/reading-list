import React from "react";

// What the pane shows and what the sidebar highlights: exactly one of these
// at a time. Owned by the shell, passed down.
export type View =
  | { kind: "items" }
  // An itemId scopes the review to that item's cards (cram mode).
  | { kind: "review"; itemId?: string }
  | { kind: "item"; id: string };

export const isActiveView = (view: View, kind: View["kind"], id?: string) =>
  view.kind === "item" ? kind === "item" && view.id === id : view.kind === kind;

// Cross-tree commands into the shell: rows deep in any list can ask for
// navigation-flavoured actions (edit an item's link, start a scoped review)
// without threading callbacks through every list. The shell is the one
// subscriber.
export type ViewCommand =
  | { kind: "edit-link"; itemId: string }
  | { kind: "review-item"; itemId: string };

const commandListeners = new Set<(command: ViewCommand) => void>();

export const dispatchViewCommand = (command: ViewCommand) => {
  for (const listener of commandListeners) listener(command);
};

export const useViewCommands = (handler: (command: ViewCommand) => void) => {
  const handlerRef = React.useRef(handler);
  React.useEffect(() => {
    handlerRef.current = handler;
  });
  React.useEffect(() => {
    const listener = (command: ViewCommand) => handlerRef.current(command);
    commandListeners.add(listener);
    return () => {
      commandListeners.delete(listener);
    };
  }, []);
};

// The current view, published for the dev banner (the shell's selection is
// in-memory state, so the URL alone doesn't say where you are). Module-level
// store: the banner lives outside the shell's tree.
let devView: View | null = null;
const devViewListeners = new Set<() => void>();

export const publishDevView = (view: View | null) => {
  devView = view;
  for (const listener of devViewListeners) listener();
};

const subscribeDevView = (listener: () => void) => {
  devViewListeners.add(listener);
  return () => {
    devViewListeners.delete(listener);
  };
};

export const useDevView = (): View | null =>
  React.useSyncExternalStore(
    subscribeDevView,
    () => devView,
    () => null,
  );

export const devViewLabel = (view: View): string =>
  view.kind === "item" ? `item ${view.id.slice(0, 8)}` : view.kind;
