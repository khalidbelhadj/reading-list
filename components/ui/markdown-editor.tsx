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
import { toast } from "sonner";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { cn } from "@/lib/utils";
import { requestImageUpload } from "@/app/actions-storage";
import { ImageUpload } from "@/lib/tiptap-image-upload";
import { Card, CardFront, CardBack } from "@/components/ui/markdown-card";

const ImageLightbox = ({
  src,
  alt,
  onOpenChange,
}: {
  src: string | null;
  alt: string;
  onOpenChange: (open: boolean) => void;
}) => {
  const handlePopupClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) onOpenChange(false);
    },
    [onOpenChange],
  );
  return (
    <DialogPrimitive.Root open={src !== null} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/85 data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 duration-100" />
        <DialogPrimitive.Popup
          aria-label="Image preview"
          onClick={handlePopupClick}
          className="fixed inset-0 z-50 flex items-center justify-center p-6 outline-none data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 duration-100"
        >
          {src && (
            // next/image needs known dimensions; previewed images are user-pasted with arbitrary sizes.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt}
              className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            />
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

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
    const exitCodeBlock = (
      direction: "above" | "below",
      { editor }: { editor: Editor },
    ) => {
      const { $from, empty } = editor.state.selection;
      if (!empty || $from.parent.type !== nodeType) return false;
      const insertPos = direction === "above" ? $from.before() : $from.after();
      return editor
        .chain()
        .insertContentAt(insertPos, { type: "paragraph" })
        .setTextSelection(insertPos + 1)
        .run();
    };
    return {
      ...this.parent?.(),
      "Ctrl-e": (props) => moveWithinCodeBlock("lineEnd", props),
      End: (props) => moveWithinCodeBlock("lineEnd", props),
      "Ctrl-a": (props) => moveWithinCodeBlock("lineStart", props),
      Home: (props) => moveWithinCodeBlock("lineStart", props),
      "Mod-Shift-Enter": (props) => exitCodeBlock("above", props),
      "Mod-Enter": (props) => exitCodeBlock("below", props),
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
  const [lightboxSrc, setLightboxSrc] = React.useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = React.useState("");
  React.useEffect(() => {
    onChangeRef.current = onChange;
    onKeyDownRef.current = onKeyDown;
  });

  const handleEditorClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (target.tagName !== "IMG") return;
      const img = target as HTMLImageElement;
      if (img.dataset.uploading === "true") return;
      if (!img.src) return;
      event.preventDefault();
      setLightboxSrc(img.src);
      setLightboxAlt(img.alt || "Enlarged image");
    },
    [],
  );

  const handleLightboxOpenChange = React.useCallback((open: boolean) => {
    if (!open) setLightboxSrc(null);
  }, []);

  const getMarkdown = React.useCallback(
    (e: NonNullable<typeof editor>) =>
      (e.storage as unknown as MarkdownStorage).markdown.getMarkdown(),
    [],
  );

  const hasInflightUpload = React.useCallback((e: NonNullable<typeof editor>) => {
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
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    autofocus: autoFocus ? "end" : false,
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CodeBlockWithLineNav,
      DeleteEmptyFirstBlock,
      Card,
      CardFront,
      CardBack,
      ImageUpload.configure({
        upload: async (file) => {
          // Two-step direct upload: ask the server for a signed URL, then PUT
          // the bytes straight to Supabase. Our server only sees metadata.
          const { uploadUrl, src } = await requestImageUpload({
            contentType: file.type,
            size: file.size,
          });
          const res = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": file.type },
            body: file,
          });
          if (!res.ok) {
            throw new Error(`Upload failed (${res.status})`);
          }
          return src;
        },
        onUploadError: (message) => toast.error(message),
      }),
      Markdown.configure({
        html: true,
        breaks: true,
        transformPastedText: true,
      }),
      Placeholder.configure({
        includeChildren: true,
        showOnlyCurrent: false,
        placeholder: ({ pos, editor: e }) => {
          const parent = e.state.doc.resolve(pos).parent;
          if (parent.type.name === "cardFront") return "Front";
          if (parent.type.name === "cardBack") return "Back";
          return placeholder ?? "";
        },
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      if (hasInflightUpload(editor)) return;
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
    <div
      className={cn("markdown-editor w-full", className)}
      onClick={handleEditorClick}
    >
      <EditorContent editor={editor} />
      <ImageLightbox src={lightboxSrc} alt={lightboxAlt} onOpenChange={handleLightboxOpenChange} />
    </div>
  );
};
