"use client";

import React from "react";
import { createPortal } from "react-dom";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import katex from "katex";

import { LatexSourceField } from "@/components/ui/latex-source-field";

// Inline math (`$…$`): renders KaTeX inline, and — when selected, clicked, or
// focused via Tab — opens a popover holding a syntax-highlighted LaTeX source
// field. The popover is portaled to <body> (ProseMirror's DOM observer tears
// down popups rendered inside the editor) and tracks the equation's position.

const renderInline = (latex: string): string | null => {
  if (latex.trim() === "") return null;
  try {
    return katex.renderToString(latex, {
      displayMode: false,
      throwOnError: false,
      strict: false,
    });
  } catch {
    return null;
  }
};

type CloseReason = "exit" | "after";

const InlineMathPopover = ({
  anchor,
  latex,
  onChange,
  onClose,
}: {
  anchor: HTMLElement;
  latex: string;
  onChange: (value: string) => void;
  onClose: (reason: CloseReason) => void;
}) => {
  const [rect, setRect] = React.useState<DOMRect | null>(() =>
    anchor.getBoundingClientRect(),
  );
  const popupRef = React.useRef<HTMLDivElement | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  // Follow the anchor's viewport position (the panel can scroll or reflow while
  // typing). Cheap: getBoundingClientRect only reflows when layout is dirty and
  // setRect no-ops when unchanged.
  React.useLayoutEffect(() => {
    let raf = 0;
    const tick = () => {
      const next = anchor.getBoundingClientRect();
      setRect((prev) =>
        prev && prev.top === next.top && prev.left === next.left ? prev : next,
      );
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [anchor]);

  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus({ preventScroll: true });
    const end = textarea.value.length;
    textarea.setSelectionRange(end, end);
  }, []);

  // Close when the user mouses down outside the popover and the equation.
  React.useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popupRef.current?.contains(target)) return;
      if (anchor.contains(target)) return;
      onClose("exit");
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [anchor, onClose]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose("exit");
      } else if (event.key === "Tab" || event.key === "Enter") {
        // Tab/Enter commit and move the caret just past the equation.
        event.preventDefault();
        onClose("after");
      }
    },
    [onClose],
  );

  if (!rect) return null;

  return createPortal(
    // The `markdown-editor`/`ProseMirror` wrapper is inert here — it only scopes
    // the shared `.latex-source` + `hljs-*` styles onto this portaled subtree.
    <div
      className="markdown-editor"
      style={{
        position: "fixed",
        top: rect.bottom + 4,
        left: rect.left,
        zIndex: 50,
      }}
    >
      <div className="ProseMirror">
        <div ref={popupRef} className="inline-math-popover">
          <LatexSourceField
            ref={textareaRef}
            value={latex}
            placeholder="LaTeX…"
            onChange={onChange}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
};

export const InlineMathNodeView = ({
  node,
  updateAttributes,
  editor,
  getPos,
  selected,
  deleteNode,
}: NodeViewProps) => {
  const latex = (node.attrs.latex as string | null) ?? "";
  const [open, setOpen] = React.useState(false);
  const wrapperRef = React.useRef<HTMLElement | null>(null);
  const rendered = React.useMemo(() => renderInline(latex), [latex]);
  const editing = open && editor.isEditable;

  // Selecting the node (click, arrow-key NodeSelection, or Tab — see the
  // extension's keyboard shortcut) opens the popover.
  React.useEffect(() => {
    if (selected && editor.isEditable) setOpen(true);
  }, [selected, editor.isEditable]);

  const handleChange = React.useCallback(
    (value: string) => updateAttributes({ latex: value }),
    [updateAttributes],
  );

  const handleClose = React.useCallback(
    (reason: CloseReason) => {
      setOpen(false);
      if (latex.trim() === "") {
        deleteNode();
        editor.commands.focus();
        return;
      }
      if (reason === "after" && typeof getPos === "function") {
        const pos = getPos();
        if (pos != null) {
          editor
            .chain()
            .setTextSelection(pos + node.nodeSize)
            .focus()
            .run();
          return;
        }
      }
      editor.commands.focus();
    },
    [deleteNode, editor, getPos, latex, node.nodeSize],
  );

  const openEditor = React.useCallback(
    (event: React.MouseEvent) => {
      if (!editor.isEditable) return;
      event.preventDefault();
      setOpen(true);
    },
    [editor.isEditable],
  );

  return (
    <NodeViewWrapper
      as="span"
      ref={wrapperRef}
      className="inline-math-node"
      data-active={editing ? "true" : undefined}
    >
      {rendered ? (
        <span
          className="inline-math-render"
          contentEditable={false}
          onMouseDown={openEditor}
          onClick={openEditor}
          dangerouslySetInnerHTML={{ __html: rendered }}
        />
      ) : (
        <span
          className="inline-math-render inline-math-render--empty"
          contentEditable={false}
          onMouseDown={openEditor}
          onClick={openEditor}
        >
          math
        </span>
      )}
      {editing && wrapperRef.current && (
        <InlineMathPopover
          anchor={wrapperRef.current}
          latex={latex}
          onChange={handleChange}
          onClose={handleClose}
        />
      )}
    </NodeViewWrapper>
  );
};
