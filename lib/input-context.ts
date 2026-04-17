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
