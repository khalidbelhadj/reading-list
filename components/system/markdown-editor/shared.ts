import type React from "react";

// Helpers shared by the editor's floating chrome (bubble menu, link popover,
// toolbar).

export const preventBlur = (event: React.MouseEvent) => {
  // Keep the editor selection alive when a toolbar control is pressed.
  event.preventDefault();
};

// Prepend a protocol when the user types a bare host so the saved href is a
// valid absolute URL. Leaves mailto:, anchors and already-qualified URLs alone.
export const normalizeHref = (raw: string) => {
  const href = raw.trim();
  if (!href) return "";
  if (/^(https?:\/\/|mailto:|#|\/)/i.test(href)) return href;
  return `https://${href}`;
};
