import React from "react";
import { useStore } from "./index";
import type { Item } from "@/lib/types";

export function useItems(): Item[] {
  const itemsMap = useStore((s) => s.items);
  return React.useMemo(
    () =>
      Array.from(itemsMap.values()).sort((a, b) => {
        if (a.type !== b.type) return a.type === "reading-list" ? -1 : 1;
        return a.position - b.position;
      }),
    [itemsMap],
  );
}

export function useIsHydrated(): boolean {
  return useStore((s) => s.isHydrated);
}

export function useIsSyncing(): boolean {
  return useStore((s) => s.isSyncing);
}

export function usePendingCount(): number {
  return useStore((s) => s.mutationQueue.filter((m) => m.status === "pending" || m.status === "in-flight").length);
}

export function useIsOnline(): boolean {
  return useStore((s) => s.isOnline);
}

export function useCanUndo(): boolean {
  return useStore((s) => s.undoStack.length > 0);
}

export function useCanRedo(): boolean {
  return useStore((s) => s.redoStack.length > 0);
}
