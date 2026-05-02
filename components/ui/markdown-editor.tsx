"use client";

import React from "react";
import {
  useEditor,
  EditorContent,
  Extension,
  type Editor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import CodeBlock from "@tiptap/extension-code-block";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";

import { cn } from "@/lib/utils";

type MarkdownStorage = { markdown: { getMarkdown: () => string } };

// Browsers treat raw "\n" inside a contenteditable <pre> as part of one big
// "line" for selection movement, so macOS Ctrl-e/Ctrl-a and the Home/End keys
// skip to the bounds of the whole code block. Bind those keys to walk to the
// nearest "\n" (or block edge) manually so they behave per-line like
// everywhere else. Always consume the event — returning false would let the
// browser fall back to the broken native behavior.
// ProseMirror's default Backspace at the start of the very first block does
// nothing — there's no previous block to merge with and the doc requires at
// least one child. When that first block is empty AND there's content below,
// drop it so the cursor lands at the start of the next block.
const DeleteEmptyFirstBlock = Extension.create({
  name: "deleteEmptyFirstBlock",
  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }: { editor: Editor }) => {
        const { state } = editor;
        const { selection, doc, tr } = state;
        const { $from, empty } = selection;
        if (!empty) return false;
        if ($from.depth !== 1) return false;
        if ($from.parentOffset !== 0) return false;
        if ($from.before(1) !== 0) return false;
        if ($from.parent.content.size !== 0) return false;
        if (doc.childCount < 2) return false;
        const end = $from.after(1);
        editor.view.dispatch(tr.delete(0, end).scrollIntoView());
        return true;
      },
    };
  },
});

const CodeBlockWithLineNav = CodeBlock.extend({
  addKeyboardShortcuts() {
    const nodeType = this.type;
    const moveWithinCodeBlock = (
      direction: "lineStart" | "lineEnd",
      { editor }: { editor: Editor },
    ) => {
      const { selection } = editor.state;
      const { $from, empty } = selection;
      if (!empty || $from.parent.type !== nodeType) return false;
      const text = $from.parent.textContent;
      const offset = $from.parentOffset;
      let target: number;
      if (direction === "lineEnd") {
        const next = text.indexOf("\n", offset);
        target = next === -1 ? text.length : next;
      } else {
        const prev = text.lastIndexOf("\n", offset - 1);
        target = prev === -1 ? 0 : prev + 1;
      }
      if (target !== offset) {
        editor.commands.setTextSelection($from.start() + target);
      }
      return true;
    };
    return {
      ...this.parent?.(),
      "Ctrl-e": (props) => moveWithinCodeBlock("lineEnd", props),
      End: (props) => moveWithinCodeBlock("lineEnd", props),
      "Ctrl-a": (props) => moveWithinCodeBlock("lineStart", props),
      Home: (props) => moveWithinCodeBlock("lineStart", props),
    };
  },
});

export const MarkdownEditor = ({
  value,
  onChange,
  placeholder,
  className,
  editable = true,
  autoFocus = false,
  editorAttributes,
  onKeyDown,
}: {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
  autoFocus?: boolean;
  editorAttributes?: Record<string, string>;
  onKeyDown?: (event: KeyboardEvent) => boolean | void;
}) => {
  const onChangeRef = React.useRef(onChange);
  const onKeyDownRef = React.useRef(onKeyDown);
  React.useEffect(() => {
    onChangeRef.current = onChange;
    onKeyDownRef.current = onKeyDown;
  });

  const getMarkdown = React.useCallback(
    (e: NonNullable<typeof editor>) =>
      (e.storage as unknown as MarkdownStorage).markdown.getMarkdown(),
    [],
  );

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    autofocus: autoFocus ? "end" : false,
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CodeBlockWithLineNav,
      DeleteEmptyFirstBlock,
      Markdown.configure({
        html: false,
        breaks: true,
        transformPastedText: true,
      }),
      ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChangeRef.current?.(getMarkdown(editor));
    },
    editorProps: {
      attributes: editorAttributes ?? {},
      handleKeyDown: (_view, event) => {
        return onKeyDownRef.current?.(event) ?? false;
      },
    },
  });

  React.useEffect(() => {
    if (!editor) return;
    if (getMarkdown(editor) !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor, getMarkdown]);

  React.useEffect(() => {
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable);
    }
  }, [editable, editor]);

  return (
    <div className={cn("markdown-editor w-full", className)}>
      <EditorContent editor={editor} />
    </div>
  );
};
