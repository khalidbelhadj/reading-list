"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";

import { type Item } from "@/lib/types";
import { fetchItems } from "@/lib/queries";
import { ItemsList } from "@/components/items-list";
import { SlidingItemPanel } from "@/components/items-list/sliding-item-panel";
import { setOpenItemId as setOpenItemIdStore } from "@/components/items-list/cursor-store";

export const PanelLayout = () => {
  const { data: items } = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: fetchItems,
    staleTime: Infinity,
  });

  const [openItemId, setOpenItemId] = React.useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("item");
  });
  // Incremented to ask SlidingItemPanel to expand the open item to fullw
  // once it reaches side phase. Used by Cmd+Enter on a list row.
  const [expandTrigger, setExpandTrigger] = React.useState(0);

  React.useEffect(() => {
    const onPop = () => {
      const id = new URLSearchParams(window.location.search).get("item");
      setOpenItemId(id);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // On the first home-page visit per session, restore the last-opened item
  // in the panel if it still exists.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("home-visited") === "1") return;
    if (!items) return;
    sessionStorage.setItem("home-visited", "1");
    if (openItemId) return;
    let lastId: string | null = null;
    try {
      lastId = localStorage.getItem("last-item-id");
    } catch {
      return;
    }
    if (!lastId) return;
    if (items.some((i) => i.id === lastId)) {
      const params = new URLSearchParams(window.location.search);
      params.set("item", lastId);
      window.history.replaceState(null, "", `?${params.toString()}`);
      setOpenItemId(lastId);
    } else {
      try {
        localStorage.removeItem("last-item-id");
      } catch {}
    }
  }, [items, openItemId]);

  React.useEffect(() => {
    if (!openItemId) return;
    try {
      localStorage.setItem("last-item-id", openItemId);
    } catch {}
  }, [openItemId]);

  // Mirror to the imperative store so list rows highlight the open item
  // without forcing the full list to re-render.
  React.useEffect(() => {
    setOpenItemIdStore(openItemId);
    return () => setOpenItemIdStore(null);
  }, [openItemId]);

  const handleCloseItem = React.useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("item")) {
      params.delete("item");
      const qs = params.toString();
      window.history.replaceState(
        null,
        "",
        qs ? `?${qs}` : window.location.pathname,
      );
    }
    setOpenItemId(null);
  }, []);

  const handleOpenItem = React.useCallback(
    (id: string) => {
      const params = new URLSearchParams(window.location.search);
      const current = params.get("item");
      if (current === id) {
        handleCloseItem();
        return;
      }
      params.set("item", id);
      const url = `?${params.toString()}`;
      if (current) {
        window.history.replaceState(null, "", url);
      } else {
        window.history.pushState(null, "", url);
      }
      setOpenItemId(id);
    },
    [handleCloseItem],
  );

  const handleOpenItemExpanded = React.useCallback(
    (id: string) => {
      // Open without the toggle-close behavior — Cmd+Enter on an already-open
      // item should expand it, not close it.
      const params = new URLSearchParams(window.location.search);
      const current = params.get("item");
      if (current !== id) {
        params.set("item", id);
        const url = `?${params.toString()}`;
        if (current) {
          window.history.replaceState(null, "", url);
        } else {
          window.history.pushState(null, "", url);
        }
        setOpenItemId(id);
      }
      setExpandTrigger((t) => t + 1);
    },
    [],
  );

  return (
    <div className="h-dvh overflow-hidden">
      <div className="h-full p-3">
        <div className="h-full flex flex-col md:flex-row">
          <ItemsList
            onOpenItem={handleOpenItem}
            onOpenItemExpanded={handleOpenItemExpanded}
          />
          <SlidingItemPanel
            itemId={openItemId}
            onClose={handleCloseItem}
            expandTrigger={expandTrigger}
          />
        </div>
      </div>
    </div>
  );
};
