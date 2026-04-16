"use client";

import React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";

import { cn } from "@/lib/utils";

type MarkdownStorage = { markdown: { getMarkdown: () => string } };

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
  const isInternalUpdate = React.useRef(false);
  const onChangeRef = React.useRef(onChange);
  const onKeyDownRef = React.useRef(onKeyDown);
  React.useEffect(() => {
    onChangeRef.current = onChange;
    onKeyDownRef.current = onKeyDown;
  });

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    autofocus: autoFocus ? "end" : false,
    extensions: [
      StarterKit,
      Markdown.configure({
        html: false,
        breaks: true,
        transformPastedText: true,
      }),
      ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      isInternalUpdate.current = true;
      const md = (editor.storage as unknown as MarkdownStorage).markdown.getMarkdown();
      // Strip trailing whitespace that ProseMirror's mandatory trailing
      // paragraph adds (e.g. after a list at the end of the doc).
      onChangeRef.current?.(md.replace(/\s+$/, ""));
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
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    const current = (editor.storage as unknown as MarkdownStorage).markdown.getMarkdown();
    if (current !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

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
