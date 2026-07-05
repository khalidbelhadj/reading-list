// A tiny event bus for "reveal this item in the list" — scroll it into view and
// center it. Producers (cross-window "Open in list", OS deep links) live outside
// ItemsList, which owns the scroll registry, so they dispatch and ItemsList
// actuates. Opening the panel is separate (the URL param); this only handles the
// list-scroll half.
const EVENT = "rl:reveal-item";

export const dispatchRevealItem = (itemId: string): void => {
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: itemId }));
};

export const subscribeRevealItem = (
  handler: (itemId: string) => void,
): (() => void) => {
  const listener = (event: Event) => {
    handler((event as CustomEvent<string>).detail);
  };
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
};
