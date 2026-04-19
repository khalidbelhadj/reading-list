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
  const onChangeRef = React.useRef(onChange);
  const onKeyDownRef = React.useRef(onKeyDown);
  React.useEffect(() => {
    onChangeRef.current = onChange;
    onKeyDownRef.current = onKeyDown;
  });

  // ProseMirror adds a mandatory trailing paragraph, so getMarkdown() has a
  // trailing newline that the stored value does not. Normalize both sides
  // when comparing or emitting.
  const normalize = (md: string) => md.replace(/\s+$/, "");
  const getMarkdown = React.useCallback(
    (e: NonNullable<typeof editor>) =>
      normalize(
        (e.storage as unknown as MarkdownStorage).markdown.getMarkdown(),
      ),
    [],
  );

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
