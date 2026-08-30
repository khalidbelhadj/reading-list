import { type NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import katex from "katex";
import React from "react";
import { createPortal } from "react-dom";

import { useAnchoredPopover } from "@/lib/editor/use-anchored-popover";

import { LatexSourceField } from "./latex-source-field";

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
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  // Follows the equation's viewport position (the panel can scroll or reflow
  // while typing) and closes on a mousedown outside the popover and the
  // equation. Escape is handled by the textarea itself (it also commits vs.
  // exits differently), so the hook's Escape handling is off.
  const getAnchor = React.useCallback(
    () => anchor.getBoundingClientRect(),
    [anchor],
  );
  const isInsideAnchor = React.useCallback(
    (target: Node) => anchor.contains(target),
    [anchor],
  );
  const handleDismiss = React.useCallback(() => onClose("exit"), [onClose]);
  const { popoverRef, style } = useAnchoredPopover({
    open: true,
    getAnchor,
    offset: 4,
    onDismiss: handleDismiss,
    isInside: isInsideAnchor,
    closeOnEscape: false,
  });

  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus({ preventScroll: true });
    const end = textarea.value.length;
    textarea.setSelectionRange(end, end);
  }, []);

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

  if (!style) return null;

  return createPortal(
    // The `markdown-editor`/`ProseMirror` wrapper is inert here — it only scopes
    // the shared `.latex-source` + `hljs-*` styles onto this portaled subtree.
    <div ref={popoverRef} className="markdown-editor z-50" style={style}>
      <div className="ProseMirror">
        <div className="inline-math-popover">
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
    // Only a selection the user made (the editor has focus) opens the
    // popover; a programmatic load can leave the node selected too.
    if (selected && editor.isEditable && editor.isFocused) setOpen(true);
  }, [selected, editor.isEditable, editor.isFocused]);

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
