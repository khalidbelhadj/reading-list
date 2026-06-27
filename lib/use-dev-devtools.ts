import { useCallback, useSyncExternalStore } from "react";

// Shared, localStorage-backed toggle for the React Query devtools. The dev
// banner (outside QueryProvider) flips it; QueryProvider reads it to mount or
// unmount <ReactQueryDevtools>. A custom event keeps both in sync within the
// same tab; the native "storage" event covers other tabs.
const KEY = "dev-rq-devtools";
const EVENT = "dev-rq-devtools-change";

const subscribe = (callback: () => void) => {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
};

const getSnapshot = () => localStorage.getItem(KEY) === "1";
const getServerSnapshot = () => false;

export const useDevDevtools = () => {
  const enabled = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const setEnabled = useCallback((value: boolean) => {
    localStorage.setItem(KEY, value ? "1" : "0");
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return [enabled, setEnabled] as const;
};
