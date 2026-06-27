import React from "react";

/**
 * Shares the scroll viewport that virtualized lists window against, so a
 * {@link VirtualList} (or anything built on it) can be dropped anywhere inside
 * a `VirtualScrollProvider` without being handed an explicit `scrollElementRef`.
 */
const VirtualScrollContext =
  React.createContext<React.RefObject<HTMLElement | null> | null>(null);

export const VirtualScrollProvider = ({
  scrollRef,
  children,
}: {
  scrollRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}) => (
  <VirtualScrollContext.Provider value={scrollRef}>
    {children}
  </VirtualScrollContext.Provider>
);

export const useVirtualScrollRef = () => React.useContext(VirtualScrollContext);
