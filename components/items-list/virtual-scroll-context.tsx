import React from "react";

type VirtualScrollContextValue = {
  // Imperative handle for one-off reads (e.g. scrollIntoView). Stable identity.
  scrollRef: React.RefObject<HTMLElement | null>;
  // The resolved scroll node, tracked as state so consumers re-render — and
  // their measurement effects re-run — the moment the shared container mounts.
  // A bare ref can't do this: when the container remounts (e.g. navigating away
  // and back in the SPA), a child's layout effect can fire before the ref is
  // attached, read null, and never recover because the ref object's identity
  // never changes. Threading the node as state fixes that.
  scrollElement: HTMLElement | null;
};

/**
 * Shares the scroll viewport that virtualized lists window against, so a
 * {@link VirtualList} (or anything built on it) can be dropped anywhere inside
 * a `VirtualScrollProvider` without being handed an explicit `scrollElementRef`.
 */
const VirtualScrollContext =
  React.createContext<VirtualScrollContextValue | null>(null);

export const VirtualScrollProvider = ({
  scrollRef,
  scrollElement,
  children,
}: {
  scrollRef: React.RefObject<HTMLElement | null>;
  scrollElement: HTMLElement | null;
  children: React.ReactNode;
}) => {
  const value = React.useMemo(
    () => ({ scrollRef, scrollElement }),
    [scrollRef, scrollElement],
  );
  return (
    <VirtualScrollContext.Provider value={value}>
      {children}
    </VirtualScrollContext.Provider>
  );
};

export const useVirtualScroll = () => React.useContext(VirtualScrollContext);

export const useVirtualScrollRef = () =>
  React.useContext(VirtualScrollContext)?.scrollRef ?? null;
