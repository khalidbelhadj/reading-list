"use client";

import React from "react";
import { createPortal } from "react-dom";
import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import {
  IconCheck,
  IconCopy,
  IconCopyPlus,
  IconDotsVertical,
  IconGripVertical,
  IconTrash,
} from "@tabler/icons-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { newCardId } from "@/lib/card-id";
import { cn } from "@/lib/utils";

// A self-contained menu portaled to <body>. We deliberately avoid the base-ui
// DropdownMenu here: its FloatingFocusManager marks the trigger's ancestors
// inert on open, and when the trigger lives inside the editor that write lands
// on ProseMirror's content nodes and tears the node view down (same reasoning
// as the code block toolbar). A plain portal never touches the editor DOM, so
// the trigger can stay in-place next to the drag handle.
const CardMenu = ({
  anchor,
  onCopy,
  onDuplicate,
  onDelete,
  onClose,
}: {
  anchor: DOMRect;
  onCopy: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState(false);

  const handleCopyClick = React.useCallback(() => {
    onCopy();
    setCopied(true);
  }, [onCopy]);

  React.useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timeout);
  }, [copied]);

  React.useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    // The menu is position:fixed, so close it if the page scrolls or resizes
    // rather than letting it drift away from the card.
    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  const style: React.CSSProperties = {
    top: anchor.bottom + 4,
    left: anchor.right,
    transform: "translateX(-100%)",
  };

  const itemClass =
    "flex min-h-6 w-full cursor-default items-center gap-1.5 rounded-md px-2 py-0.5 text-left text-xs outline-hidden select-none hover:bg-muted [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-muted-foreground";

  return createPortal(
    <div
      ref={ref}
      role="menu"
      className="fixed z-50 min-w-36 rounded-lg bg-popover p-1 text-popover-foreground shadow-depth-floating ring-1 ring-foreground/10"
      style={style}
    >
      <Tooltip open={copied}>
        <TooltipTrigger
          render={
            <button
              type="button"
              role="menuitem"
              className={itemClass}
              onClick={handleCopyClick}
            />
          }
        >
          {copied ? <IconCheck /> : <IconCopy />}
          Copy text
        </TooltipTrigger>
        <TooltipContent>Copied</TooltipContent>
      </Tooltip>
      <button
        type="button"
        role="menuitem"
        className={itemClass}
        onClick={onDuplicate}
      >
        <IconCopyPlus />
        Duplicate
      </button>
      <button
        type="button"
        role="menuitem"
        className={cn(
          itemClass,
          "text-destructive hover:bg-destructive/10 [&_svg]:text-destructive",
        )}
        onClick={onDelete}
      >
        <IconTrash />
        Delete
      </button>
    </div>,
    document.body,
  );
};

export const CardNodeView = ({ node, editor, getPos }: NodeViewProps) => {
  const [menuButton, setMenuButton] = React.useState<HTMLButtonElement | null>(
    null,
  );
  const [anchor, setAnchor] = React.useState<DOMRect | null>(null);

  const resolvePos = React.useCallback(() => {
    if (typeof getPos !== "function") return null;
    const pos = getPos();
    return typeof pos === "number" ? pos : null;
  }, [getPos]);

  const closeMenu = React.useCallback(() => setAnchor(null), []);

  const handleCopy = React.useCallback(() => {
    // Keep the menu open so the "Copied" tooltip + check icon are visible;
    // it dismisses on the next outside-click or Escape.
    const sides: string[] = [];
    node.forEach((child) => sides.push(child.textContent));
    void navigator.clipboard?.writeText(sides.join("\n\n").trim());
  }, [node]);

  const handleDuplicate = React.useCallback(() => {
    closeMenu();
    const pos = resolvePos();
    if (pos == null) return;
    // A duplicated card needs its own id so the notes→DB reconcile treats it as
    // a new flashcard rather than a collision with the original.
    const json = node.toJSON();
    json.attrs = { ...(json.attrs ?? {}), cardId: newCardId() };
    editor
      .chain()
      .focus()
      .insertContentAt(pos + node.nodeSize, json)
      .run();
  }, [closeMenu, editor, node, resolvePos]);

  const handleDelete = React.useCallback(() => {
    closeMenu();
    const pos = resolvePos();
    if (pos == null) return;
    editor
      .chain()
      .focus()
      .deleteRange({ from: pos, to: pos + node.nodeSize })
      .run();
  }, [closeMenu, editor, node, resolvePos]);

  const toggleMenu = React.useCallback(() => {
    setAnchor((current) =>
      current ? null : (menuButton?.getBoundingClientRect() ?? null),
    );
  }, [menuButton]);

  return (
    <NodeViewWrapper className="card-node">
      {editor.isEditable && (
        <div
          className="card-controls"
          contentEditable={false}
          data-menu-open={anchor ? "" : undefined}
        >
          {/* Drag affordance — leave its native mousedown/dragstart untouched so
              ProseMirror can move the whole card node. */}
          <div
            data-drag-handle
            role="button"
            aria-label="Drag card"
            className="card-control-button"
          >
            <IconGripVertical />
          </div>
          <button
            ref={setMenuButton}
            type="button"
            aria-label="Card actions"
            className="card-control-button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={toggleMenu}
          >
            <IconDotsVertical />
          </button>
        </div>
      )}
      {anchor && (
        <CardMenu
          anchor={anchor}
          onCopy={handleCopy}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onClose={closeMenu}
        />
      )}
      <NodeViewContent className="card-block" />
    </NodeViewWrapper>
  );
};
