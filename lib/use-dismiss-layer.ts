import React from "react";

import { pushDismissLayer } from "@/lib/dismiss-stack";

// Registers a dismissible layer on the global Escape stack while `active` is
// true, and unregisters it when `active` goes false or the component unmounts.
// Pressing Escape dismisses the top-most layer (most recently opened/focused
// first). See lib/dismiss-stack.ts for the stack semantics.
//
//   active   — whether this layer is currently open/dismissible.
//   onDismiss— the "undo this action" effect (close panel, clear search, …).
//   contains — optional: reports whether a node belongs to this layer, so
//              re-focusing it promotes the layer back to the top.
export const useDismissLayer = ({
  active,
  onDismiss,
  contains,
}: {
  active: boolean;
  onDismiss: () => void;
  contains?: (node: Node) => boolean;
}) => {
  // Mirror the callbacks in refs so the layer is pushed once per activation
  // rather than re-pushed whenever a parent re-renders with new closures.
  const onDismissRef = React.useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const containsRef = React.useRef(contains);
  containsRef.current = contains;

  React.useEffect(() => {
    if (!active) return;
    return pushDismissLayer(() => onDismissRef.current(), {
      contains: (node) => containsRef.current?.(node) ?? false,
    });
  }, [active]);
};
