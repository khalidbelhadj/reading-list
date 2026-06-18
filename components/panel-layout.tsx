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
  });

  const [openItemId, setOpenItemId] = React.useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("item");
  });
  // Whether the open item is shown expanded (fullw). Mirrored to the
  // ?expanded=1 URL param so expanded mode is deep-linkable and survives
  // reload/back-forward. Only meaningful when an item is open.
  const [expanded, setExpanded] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("expanded") != null;
  });

  // Mount the panel only after client hydration. The panel's inline styles
  // depend on orientation (matchMedia), which differs between server and
  // client — deferring avoids the hydration mismatch that would otherwise
  // force React to keep the (wrong) server-rendered orientation.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      setOpenItemId(params.get("item"));
      setExpanded(params.get("expanded") != null);
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
    if (params.has("item") || params.has("expanded")) {
      params.delete("item");
      params.delete("expanded");
      const qs = params.toString();
      window.history.replaceState(
        null,
        "",
        qs ? `?${qs}` : window.location.pathname,
      );
    }
    setOpenItemId(null);
    setExpanded(false);
  }, []);

  // If the open item disappears from the cache (deleted from anywhere —
  // row dropdown, keyboard shortcut, server refetch), close the panel.
  React.useEffect(() => {
    if (!openItemId || !items) return;
    if (!items.some((i) => i.id === openItemId)) {
      handleCloseItem();
    }
  }, [openItemId, items, handleCloseItem]);

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

  const handleOpenItemExpanded = React.useCallback((id: string) => {
    // Open without the toggle-close behavior — Cmd+Enter on an already-open
    // item should expand it, not close it.
    const params = new URLSearchParams(window.location.search);
    const current = params.get("item");
    params.set("item", id);
    params.set("expanded", "1");
    const url = `?${params.toString()}`;
    if (current) {
      window.history.replaceState(null, "", url);
    } else {
      window.history.pushState(null, "", url);
    }
    setOpenItemId(id);
    setExpanded(true);
  }, []);

  // Reflect manual expand/restore (toolbar button, Cmd+] / Cmd+[) into the
  // URL so the address bar always points at the current view — replaceState
  // since toggling the view shouldn't add a history entry.
  const handleExpandedChange = React.useCallback((next: boolean) => {
    const params = new URLSearchParams(window.location.search);
    if (next) params.set("expanded", "1");
    else params.delete("expanded");
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `?${qs}` : window.location.pathname,
    );
    setExpanded(next);
  }, []);

  return (
    <div className="h-dvh overflow-hidden">
      <div className="h-full p-2">
        <div className="flex h-full flex-col md:flex-row">
          <ItemsList
            onOpenItem={handleOpenItem}
            onOpenItemExpanded={handleOpenItemExpanded}
          />
          {mounted && (
            <SlidingItemPanel
              itemId={openItemId}
              onClose={handleCloseItem}
              expanded={expanded}
              onExpandedChange={handleExpandedChange}
            />
          )}
        </div>
      </div>
    </div>
  );
};
