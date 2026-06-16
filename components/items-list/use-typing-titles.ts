import React from "react";

/**
 * Drives the per-row "typewriter" title animation used after pasting a URL:
 * the row appears immediately with its fetched title, then we replay that title
 * one character at a time as a visual flourish. `typingTitles[itemId]` holds
 * the partial string while animating and is deleted once complete (the row then
 * falls back to the real cached title).
 */
export const useTypingTitles = () => {
  const [typingTitles, setTypingTitles] = React.useState<
    Record<string, string>
  >({});

  const animateTypingTitle = React.useCallback(
    (itemId: string, target: string) =>
      new Promise<void>((resolve) => {
        if (!target) {
          resolve();
          return;
        }
        let i = 0;
        setTypingTitles((prev) => ({ ...prev, [itemId]: "" }));
        const interval = setInterval(() => {
          i++;
          const partial = target.slice(0, i);
          setTypingTitles((prev) => ({ ...prev, [itemId]: partial }));
          if (i >= target.length) {
            clearInterval(interval);
            setTypingTitles((prev) => {
              const next = { ...prev };
              delete next[itemId];
              return next;
            });
            resolve();
          }
        }, 15);
      }),
    [],
  );

  return { typingTitles, animateTypingTitle };
};
