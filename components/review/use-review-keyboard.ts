import React from "react";

import type { Rating } from "@/lib/srs";

import { RATINGS } from "./ratings";

// Global keydown handling for a running review: Space reveals, Escape asks to
// end, S skips, 1-4 rate once revealed. Typing contexts are ignored, and while
// the end-session popover is open it owns the keyboard.
//
// The handler re-subscribes whenever any input (revealed, endConfirmOpen, the
// callbacks) changes — no ref mirrors. Subscription churn on a keydown
// listener is harmless, and one consistent story beats mirroring some inputs
// into refs while depending on others.
export const useReviewKeyboard = ({
  enabled,
  revealed,
  endConfirmOpen,
  onReveal,
  onRate,
  onSkip,
  onRequestEnd,
}: {
  enabled: boolean;
  revealed: boolean;
  endConfirmOpen: boolean;
  onReveal: () => void;
  onRate: (rating: Rating) => void;
  onSkip: () => void;
  onRequestEnd: () => void;
}) => {
  React.useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement) {
        const tag = e.target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          e.target.isContentEditable
        ) {
          return;
        }
      }
      // While the end-session popover is open it owns the keyboard — let it
      // handle Escape/outside-click to close; don't rate or skip behind it.
      if (endConfirmOpen) return;
      if (e.key === " ") {
        e.preventDefault();
        if (!revealed) onReveal();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onRequestEnd();
        return;
      }
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        onSkip();
        return;
      }
      if (!revealed) return;
      const rating = RATINGS.find((r) => r.key === e.key);
      if (rating) {
        e.preventDefault();
        onRate(rating.value);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    enabled,
    revealed,
    endConfirmOpen,
    onReveal,
    onRate,
    onSkip,
    onRequestEnd,
  ]);
};
