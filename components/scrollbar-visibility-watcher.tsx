import React from "react";

// Scrollbar thumbs are hidden by default (see the scrollbar block in
// app/globals.css). This watcher stamps [data-scrolling] on whichever element
// is actively scrolling so only its thumb shows, and clears the stamp shortly
// after the scroll settles.
const SETTLE_MS = 700;

export const ScrollbarVisibilityWatcher = () => {
  React.useEffect(() => {
    const timers = new Map<Element, number>();
    const handleScroll = (event: Event) => {
      const target =
        event.target instanceof Element
          ? event.target
          : document.documentElement;
      target.setAttribute("data-scrolling", "");
      const existing = timers.get(target);
      if (existing !== undefined) window.clearTimeout(existing);
      timers.set(
        target,
        window.setTimeout(() => {
          target.removeAttribute("data-scrolling");
          timers.delete(target);
        }, SETTLE_MS),
      );
    };
    document.addEventListener("scroll", handleScroll, {
      capture: true,
      passive: true,
    });
    return () => {
      document.removeEventListener("scroll", handleScroll, { capture: true });
      for (const timer of timers.values()) window.clearTimeout(timer);
    };
  }, []);
  return null;
};
