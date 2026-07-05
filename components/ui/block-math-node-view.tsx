import React from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import katex from "katex";

import { LatexSourceField } from "@/components/ui/latex-source-field";

// Obsidian-style "live preview" for a block-math node: while the cursor is in
// the block we show an editable LaTeX source field (styled like the editor's
// code blocks) with the rendered equation directly beneath it; when the cursor
// leaves, it collapses to just the rendered equation. The node is the official
// `blockMath` atom — its `latex` attribute is the single source of truth, so
// the markdown round-trip in markdown-math.ts is unchanged.

const renderLatex = (latex: string): string | null => {
  if (latex.trim() === "") return null;
  try {
    return katex.renderToString(latex, {
      displayMode: true,
      throwOnError: false,
      strict: false,
    });
  } catch {
    return null;
  }
};

export const BlockMathNodeView = ({
  node,
  updateAttributes,
  editor,
  getPos,
  selected,
  deleteNode,
}: NodeViewProps) => {
  const latex = (node.attrs.latex as string | null) ?? "";
  const [active, setActive] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const editing = active && editor.isEditable;
  const preview = React.useMemo(() => renderLatex(latex), [latex]);

  // Open the editor when ProseMirror selects the node — covers arrow-key entry
  // and clicking the rendered equation to select it.
  React.useEffect(() => {
    if (selected && editor.isEditable) setActive(true);
  }, [selected, editor.isEditable]);

  // A block is only ever empty right after `$$` creates it (empty blocks aren't
  // serialized, so none arrive via load) — open it for editing on mount so the
  // caret lands in the source field immediately.
  const initRef = React.useRef(false);
  React.useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    if (latex === "" && editor.isEditable) setActive(true);
  }, [latex, editor.isEditable]);

  // Focus the source field (caret at end) the moment we enter edit mode. Retry
  // once on the next frame: when the block is created by the `$$` rule the caret
  // is still being moved by ProseMirror, which can swallow the first focus.
  React.useEffect(() => {
    if (!editing) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    const focus = () => {
      if (document.activeElement === textarea) return;
      textarea.focus({ preventScroll: true });
      const end = textarea.value.length;
      textarea.setSelectionRange(end, end);
    };
    focus();
    const raf = requestAnimationFrame(focus);
    return () => cancelAnimationFrame(raf);
  }, [editing]);

  const handleChange = React.useCallback(
    (value: string) => {
      updateAttributes({ latex: value });
    },
    [updateAttributes],
  );

  // Leave the block and put the caret in the textblock on the given side,
  // creating a paragraph first if the block sits at the very edge of the doc.
  const exitToSide = React.useCallback(
    (side: "before" | "after") => {
      setActive(false);
      if (typeof getPos !== "function") return;
      const pos = getPos();
      if (pos == null) return;
      const { doc } = editor.state;
      const edge = side === "after" ? pos + node.nodeSize : pos;
      const neighbor =
        side === "after"
          ? edge <= doc.content.size
            ? doc.resolve(edge).nodeAfter
            : null
          : edge > 0
            ? doc.resolve(edge).nodeBefore
            : null;
      if (!neighbor || !neighbor.isTextblock) {
        editor
          .chain()
          .insertContentAt(edge, { type: "paragraph" })
          .setTextSelection(edge + 1)
          .focus()
          .run();
      } else {
        editor
          .chain()
          .setTextSelection(side === "after" ? edge + 1 : edge - 1)
          .focus()
          .run();
      }
    },
    [editor, getPos, node.nodeSize],
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const textarea = textareaRef.current;
      if (event.key === "Escape") {
        event.preventDefault();
        exitToSide("after");
        return;
      }
      // Backspace in an empty block removes it and returns the caret to the doc.
      if (event.key === "Backspace" && latex === "") {
        event.preventDefault();
        setActive(false);
        deleteNode();
        editor.commands.focus();
        return;
      }
      if (!textarea) return;
      const atStart =
        textarea.selectionStart === 0 && textarea.selectionEnd === 0;
      const atEnd =
        textarea.selectionStart === textarea.value.length &&
        textarea.selectionEnd === textarea.value.length;
      if (event.key === "ArrowDown" && atEnd) {
        event.preventDefault();
        exitToSide("after");
      } else if (event.key === "ArrowUp" && atStart) {
        event.preventDefault();
        exitToSide("before");
      }
    },
    [deleteNode, editor, exitToSide, latex],
  );

  // Collapse to the rendered view when focus moves to another element in the
  // document. Keep it open while focus stays within the node view, and when the
  // whole window loses focus (no relatedTarget) — switching apps shouldn't
  // collapse the equation you're editing.
  const handleBlur = React.useCallback(
    (event: React.FocusEvent<HTMLTextAreaElement>) => {
      const next = event.relatedTarget as Node | null;
      if (!next) return;
      if (wrapperRef.current && wrapperRef.current.contains(next)) return;
      setActive(false);
    },
    [],
  );

  const openForEditing = React.useCallback(
    (event: React.MouseEvent) => {
      if (!editor.isEditable) return;
      event.preventDefault();
      setActive(true);
    },
    [editor.isEditable],
  );

  return (
    <NodeViewWrapper
      ref={wrapperRef}
      className="block-math-node"
      data-active={editing ? "true" : undefined}
    >
      {editing ? (
        <div className="block-math-edit" contentEditable={false}>
          <div className="block-math-source-box">
            <LatexSourceField
              ref={textareaRef}
              value={latex}
              placeholder="LaTeX…"
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
            />
          </div>
          <div className="block-math-preview">
            {preview ? (
              <span dangerouslySetInnerHTML={{ __html: preview }} />
            ) : (
              <span className="block-math-placeholder">Preview</span>
            )}
          </div>
        </div>
      ) : (
        <div
          className="block-math-display"
          contentEditable={false}
          onMouseDown={openForEditing}
          onClick={openForEditing}
        >
          {preview ? (
            <span dangerouslySetInnerHTML={{ __html: preview }} />
          ) : (
            <span className="block-math-placeholder">Empty equation</span>
          )}
        </div>
      )}
    </NodeViewWrapper>
  );
};
