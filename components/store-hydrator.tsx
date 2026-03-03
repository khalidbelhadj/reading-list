"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import type { Item } from "@/lib/types";
import { fetchItems } from "./items-list/utils";

const SYNC_INTERVAL = 30_000; // 30 seconds

export function StoreHydrator() {
  const hydrateFromServer = useStore((s) => s.hydrateFromServer);
  const loadFromLocalStorage = useStore((s) => s.loadFromLocalStorage);
  const setOnline = useStore((s) => s.setOnline);
  const processQueue = useStore((s) => s.processQueue);
  const fullSync = useStore((s) => s.fullSync);

  // Use React Query's SSR-hydrated data
  const { data: serverItems } = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: fetchItems,
  });

  // Step 1: Load from localStorage on mount (instant data)
  const initializedRef = React.useRef(false);
  React.useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      loadFromLocalStorage();
    }
  }, [loadFromLocalStorage]);

  // Step 2: When SSR data arrives, hydrate store with fresh server data
  const hydratedRef = React.useRef(false);
  React.useEffect(() => {
    if (serverItems && !hydratedRef.current) {
      hydratedRef.current = true;
      hydrateFromServer(serverItems);
      // Drain any pending queue from previous session
      processQueue();
    }
  }, [serverItems, hydrateFromServer, processQueue]);

  // Step 3: Set real online status on mount + listen for changes
  React.useEffect(() => {
    setOnline(navigator.onLine);
    function handleOnline() {
      setOnline(true);
    }
    function handleOffline() {
      setOnline(false);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [setOnline]);

  // Step 4: Periodic full sync every 30s when online and queue is empty
  React.useEffect(() => {
    const interval = setInterval(() => {
      const state = useStore.getState();
      if (state.isOnline && state.mutationQueue.filter((m) => m.status === "pending" || m.status === "in-flight").length === 0) {
        fullSync();
      }
    }, SYNC_INTERVAL);
    return () => clearInterval(interval);
  }, [fullSync]);

  // Also sync on window focus
  React.useEffect(() => {
    function handleFocus() {
      const state = useStore.getState();
      if (state.isOnline && state.mutationQueue.filter((m) => m.status === "pending" || m.status === "in-flight").length === 0) {
        fullSync();
      }
    }
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [fullSync]);

  return null;
}
