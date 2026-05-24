import { useSyncExternalStore } from "react";

// Imperative cursor store. The cursor moves on every keystroke during nav, and
// re-rendering the entire items tree (dnd-kit + hover preview + context menus
// on ~50 rows) drops frames during key-repeat. By keeping the cursor outside
// React state and only notifying the previously-active and newly-active rows,
// nav stays at one paint per move regardless of list size.

let currentId: string | null = null;
const listeners = new Map<string, Set<() => void>>();

const getListeners = (id: string): Set<() => void> => {
  let set = listeners.get(id);
  if (!set) {
    set = new Set();
    listeners.set(id, set);
  }
  return set;
};

export const getCursorId = (): string | null => currentId;

export const setCursorId = (id: string | null): void => {
  const prev = currentId;
  if (prev === id) return;
  currentId = id;
  if (prev !== null) listeners.get(prev)?.forEach((cb) => cb());
  if (id !== null) listeners.get(id)?.forEach((cb) => cb());
};

export const useIsCursor = (id: string): boolean => {
  return useSyncExternalStore(
    (cb) => {
      const set = getListeners(id);
      set.add(cb);
      return () => {
        set.delete(cb);
        if (set.size === 0) listeners.delete(id);
      };
    },
    () => currentId === id,
    () => false,
  );
};
