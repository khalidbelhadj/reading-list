const EDITABLE_SELECTOR =
  'input, textarea, select, [contenteditable="true"], [contenteditable=""], .ProseMirror';

const isEditable = (el: Element | null | undefined): boolean => {
  if (!el) return false;
  if (el instanceof HTMLElement && el.isContentEditable) return true;
  return !!(el as Element).closest?.(EDITABLE_SELECTOR);
};

export const isTypingContext = (event?: Event): boolean => {
  if (event) {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    for (const node of path) {
      if (node instanceof Element && isEditable(node)) return true;
    }
    if (event.target instanceof Element && isEditable(event.target)) return true;
  }
  const active = document.activeElement;
  if (active && active !== document.body && isEditable(active)) return true;
  return false;
};

export const isOverlayOpen = (): boolean =>
  !!document.querySelector(
    '[role="alertdialog"], [role="dialog"], [data-slot="drawer-content"], [data-slot="dropdown-menu-content"]',
  );

// The platform's "command" modifier: Cmd (metaKey) on macOS, Ctrl elsewhere.
// We deliberately accept ONLY the native modifier — on a Mac, Ctrl+F is a
// cursor motion, so only Cmd should trigger command shortcuts; on Windows the
// Win/meta key shouldn't. Always use this for command-style shortcuts rather
// than checking metaKey/ctrlKey directly. (Accepts native and React events.)
let cachedIsApple: boolean | null = null;
const isApplePlatform = (): boolean => {
  if (cachedIsApple !== null) return cachedIsApple;
  // Don't cache during SSR — navigator isn't available, and the client value
  // is the one that matters for keyboard handling.
  if (typeof navigator === "undefined") return false;
  cachedIsApple = /mac|iphone|ipad|ipod/i.test(
    navigator.platform || navigator.userAgent || "",
  );
  return cachedIsApple;
};

export const isModKey = (event: {
  metaKey: boolean;
  ctrlKey: boolean;
}): boolean => (isApplePlatform() ? event.metaKey : event.ctrlKey);
