import { useSyncExternalStore } from "react";

// Imperative cursor store. The cursor moves on every keystroke during nav, and
// re-rendering the entire items tree (hover preview + context menus on ~50
// rows) drops frames during key-repeat. By keeping the cursor outside
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

// Same imperative pattern for "currently open in the side panel". Lives next
// to the cursor store so rows can subscribe to both without re-rendering the
// whole list on every change.
let openId: string | null = null;
const openListeners = new Map<string, Set<() => void>>();

const getOpenListeners = (id: string): Set<() => void> => {
  let set = openListeners.get(id);
  if (!set) {
    set = new Set();
    openListeners.set(id, set);
  }
  return set;
};

export const setOpenItemId = (id: string | null): void => {
  const prev = openId;
  if (prev === id) return;
  openId = id;
  if (prev !== null) openListeners.get(prev)?.forEach((cb) => cb());
  if (id !== null) openListeners.get(id)?.forEach((cb) => cb());
};

export const useIsOpenItem = (id: string): boolean => {
  return useSyncExternalStore(
    (cb) => {
      const set = getOpenListeners(id);
      set.add(cb);
      return () => {
        set.delete(cb);
        if (set.size === 0) openListeners.delete(id);
      };
    },
    () => openId === id,
    () => false,
  );
};
