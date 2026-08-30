import { type AnyExtension } from "@tiptap/core";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import React from "react";
import { Markdown } from "tiptap-markdown";

import { lowlight } from "@/lib/lowlight";
import { ImageUpload } from "@/lib/tiptap-image-upload";
import { cn } from "@/lib/utils";

import { FormatBubble } from "./markdown-editor/bubble-menu";
import {
  CleanClipboardMarkdown,
  CodeBlockWithLineNav,
  DeleteEmptyFirstBlock,
  JoinAdjacentLists,
  ParagraphWithBlankLines,
  TaskListMarkdownShortcut,
} from "./markdown-editor/extensions";
import { ImageLightbox } from "./markdown-editor/image-lightbox";
import { LinkPopover } from "./markdown-editor/link-popover";
import { BlockMath, InlineMath } from "./markdown-editor/math";
import { EditorToolbar } from "./markdown-editor/toolbar";
import { notify } from "./toast";

type MarkdownStorage = { markdown: { getMarkdown: () => string } };

// The markdown editor. Value in, markdown out; everything else is built in:
// headings, lists and checklists, quotes, code blocks with a language picker
// and copy, inline and block math, links with a click popover, images (with
// an upload hook), a formatting bubble over any selection, and an optional
// toolbar. Drop extra tiptap extensions in via `extensions` for app-specific
// nodes (item links, cards); the editor itself knows nothing about the app.
export const MarkdownEditor = ({
  value,
  onChange,
  placeholder,
  className,
  contentClassName,
  editable = true,
  autoFocus = false,
  toolbar = false,
  extensions,
  onUploadImage,
  onKeyDown,
}: {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  // Applied to the editable content area (the ProseMirror root's wrapper).
  contentClassName?: string;
  editable?: boolean;
  autoFocus?: boolean;
  // Show the formatting toolbar above the content.
  toolbar?: boolean;
  // App-level tiptap extensions appended to the built-in set.
  extensions?: AnyExtension[];
  // Upload a pasted or dropped image and return its URL. Without it, images
  // cannot be inserted.
  onUploadImage?: (file: File) => Promise<string>;
  onKeyDown?: (event: KeyboardEvent) => boolean | void;
}) => {
  const onChangeRef = React.useRef(onChange);
  const onKeyDownRef = React.useRef(onKeyDown);
  const onUploadRef = React.useRef(onUploadImage);
  const [lightbox, setLightbox] = React.useState<{
    src: string;
    alt: string;
  } | null>(null);
  React.useEffect(() => {
    onChangeRef.current = onChange;
    onKeyDownRef.current = onKeyDown;
    onUploadRef.current = onUploadImage;
  });

  const handleContentClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (target.tagName !== "IMG" || target.closest("[data-item-link]"))
        return;
      const img = target as HTMLImageElement;
      if (img.dataset.uploading === "true" || !img.src) return;
      event.preventDefault();
      setLightbox({ src: img.src, alt: img.alt || "Enlarged image" });
    },
    [],
  );

  const getMarkdown = React.useCallback(
    (e: NonNullable<typeof editor>) =>
      (e.storage as unknown as MarkdownStorage).markdown.getMarkdown(),
    [],
  );

  const hasInflightUpload = React.useCallback(
    (e: NonNullable<typeof editor>) => {
      let uploading = false;
      e.state.doc.descendants((node) => {
        if (uploading) return false;
        if (node.type.name === "image" && node.attrs.uploading) {
          uploading = true;
          return false;
        }
        return true;
      });
      return uploading;
    },
    [],
  );

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    autofocus: autoFocus ? "end" : false,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        paragraph: false,
        link: { openOnClick: false },
      }),
      ParagraphWithBlankLines,
      CodeBlockWithLineNav.configure({ lowlight }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TaskListMarkdownShortcut,
      JoinAdjacentLists,
      DeleteEmptyFirstBlock,
      InlineMath,
      BlockMath,
      ImageUpload.configure({
        upload: (file: File) => {
          const upload = onUploadRef.current;
          if (!upload)
            return Promise.reject(
              new Error("Image upload is not enabled here."),
            );
          return upload(file);
        },
        onUploadError: (message: string) =>
          notify({
            tone: "error",
            title: "Image upload failed",
            description: message,
          }),
      }),
      CleanClipboardMarkdown,
      Markdown.configure({
        html: true,
        breaks: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      Placeholder.configure({
        includeChildren: true,
        showOnlyCurrent: false,
        placeholder: placeholder ?? "",
      }),
      ...(extensions ?? []),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      if (hasInflightUpload(editor)) return;
      onChangeRef.current?.(getMarkdown(editor));
    },
    editorProps: {
      handleKeyDown: (_view, event) => onKeyDownRef.current?.(event) ?? false,
    },
  });

  React.useEffect(() => {
    if (!editor) return;
    if (getMarkdown(editor) === value) return;
    editor.commands.setContent(value, { emitUpdate: false });
    // A programmatic load leaves the selection on the last node; for an atom
    // (block math, an image) that is a node selection, which node views read
    // as "open for editing". Put the caret at the start instead unless the
    // user is actively typing here.
    if (!editor.isFocused) editor.commands.setTextSelection(0);
  }, [value, editor, getMarkdown]);

  React.useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable);
  }, [editable, editor]);

  return (
    <div
      data-slot="markdown-editor"
      className={cn("markdown-editor flex w-full flex-col gap-2", className)}
    >
      {editor && editable && toolbar && <EditorToolbar editor={editor} />}
      <div
        className={cn("min-w-0", contentClassName)}
        onClick={handleContentClick}
      >
        <EditorContent editor={editor} />
      </div>
      {editor && editable && (
        <>
          <FormatBubble editor={editor} />
          <LinkPopover editor={editor} />
        </>
      )}
      <ImageLightbox
        src={lightbox?.src ?? null}
        alt={lightbox?.alt ?? ""}
        onOpenChange={(open) => {
          if (!open) setLightbox(null);
        }}
      />
    </div>
  );
};
