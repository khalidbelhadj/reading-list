"use client";

import React from "react";
import {
  useEditor,
  EditorContent,
  Extension,
  type Editor,
} from "@tiptap/react";
import { InputRule } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Paragraph from "@tiptap/extension-paragraph";
import Placeholder from "@tiptap/extension-placeholder";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { type Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import { Markdown } from "tiptap-markdown";
import { toast } from "sonner";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { cn } from "@/lib/utils";
import { isModKey } from "@/lib/input-context";
import { requestImageUpload } from "@/app/actions-storage";
import { ImageUpload } from "@/lib/tiptap-image-upload";
import { Card, CardFront, CardBack } from "@/components/ui/markdown-card";
import { InlineMath, BlockMath } from "@/components/ui/markdown-math";
import {
  MarkdownBubbleMenu,
  MarkdownLinkMenu,
} from "@/components/ui/markdown-bubble-menu";
import { CodeBlockNodeView } from "@/components/ui/code-block-node-view";
import { lowlight } from "@/lib/lowlight";
import { BLANK_LINE_SENTINEL, stripBlankLineSentinel } from "@/lib/markdown";

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

  React.useEffect(() => {
    if (!src) return;
    const handler = async (event: KeyboardEvent) => {
      if (!isModKey(event) || event.key !== "c") return;
      if (window.getSelection()?.toString()) return;
      event.preventDefault();
      try {
        const response = await fetch(src);
        const sourceBlob = await response.blob();
        const bitmap = await createImageBitmap(sourceBlob);
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no canvas context");
        ctx.drawImage(bitmap, 0, 0);
        const pngBlob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/png"),
        );
        if (!pngBlob) throw new Error("encode failed");
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": pngBlob }),
        ]);
        toast("Image copied");
      } catch {
        toast.error("Couldn't copy image", {
          description: "Your browser may have blocked clipboard access.",
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [src]);

  return (
    <DialogPrimitive.Root open={src !== null} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/50 duration-75 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          aria-label="Image preview"
          onClick={handlePopupClick}
          className="fixed inset-0 z-50 flex items-center justify-center p-6 duration-75 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
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

const CodeBlockWithLineNav = CodeBlockLowlight.extend({
  addNodeView() {
    // The language picker is portaled to <body> from the node view, so its
    // base-ui menu never touches the editor DOM — no stopEvent / ignoreMutation
    // overrides are needed. See components/ui/code-block-node-view.tsx.
    return ReactNodeViewRenderer(CodeBlockNodeView);
  },
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
    const insertIndent = ({ editor }: { editor: Editor }) => {
      // Tab indents within a code block (4 spaces) instead of moving focus out
      // of the editor. Handles a collapsed caret or a selection (replaced with
      // the indent); returns false elsewhere so Tab keeps its default behavior.
      // Insert a text node, not a plain string — tiptap parses a string as HTML
      // and collapses the leading spaces, so "    " would vanish.
      const { $from } = editor.state.selection;
      if ($from.parent.type !== nodeType) return false;
      return editor.commands.insertContent({ type: "text", text: "    " });
    };
    return {
      ...this.parent?.(),
      Tab: (props) => insertIndent(props),
      "Ctrl-e": (props) => moveWithinCodeBlock("lineEnd", props),
      End: (props) => moveWithinCodeBlock("lineEnd", props),
      "Ctrl-a": (props) => moveWithinCodeBlock("lineStart", props),
      Home: (props) => moveWithinCodeBlock("lineStart", props),
      "Mod-Shift-Enter": (props) => exitCodeBlock("above", props),
      "Mod-Enter": (props) => exitCodeBlock("below", props),
    };
  },
});

// tiptap-markdown serializes an empty paragraph to a blank line, and plain
// markdown collapses consecutive blank lines on re-parse — so a deliberate
// empty line between two paragraphs silently disappears on the next load. Emit
// a non-breaking space for empty paragraphs instead: markdown-it parses it back
// into a paragraph, so intentional blank lines survive the round-trip.
type MarkdownSerializeState = {
  write: (content: string) => void;
  closeBlock: (node: ProseMirrorNode) => void;
  renderInline: (node: ProseMirrorNode) => void;
};

const ParagraphWithBlankLines = Paragraph.extend({
  addStorage() {
    return {
      markdown: {
        serialize(state: MarkdownSerializeState, node: ProseMirrorNode) {
          if (node.content.size === 0) {
            state.write(BLANK_LINE_SENTINEL);
            state.closeBlock(node);
            return;
          }
          state.renderInline(node);
          state.closeBlock(node);
        },
        parse: {},
      },
    };
  },
});

// tiptap-markdown's `transformCopiedText` serializes the selection to markdown on
// copy, which emits the blank-line sentinel (see above) into the clipboard. Strip
// it here so every in-editor copy — notes or flashcards, anywhere the editor is
// used — yields clean markdown. Higher priority than the Markdown extension (50)
// so this clipboardTextSerializer wins over tiptap-markdown's.
type MarkdownSerializer = {
  markdown: {
    serializer: { serialize: (content: ProseMirrorNode["content"]) => string };
  };
};

const CleanClipboardMarkdown = Extension.create({
  name: "cleanClipboardMarkdown",
  priority: 100,
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        props: {
          clipboardTextSerializer: (slice) => {
            const storage = editor.storage as unknown as MarkdownSerializer;
            return stripBlankLineSentinel(
              storage.markdown.serializer.serialize(slice.content),
            );
          },
        },
      }),
    ];
  },
});

// TipTap's built-in task-list rule only fires on a bare "[ ] " at the start of
// a line. People type the GFM form "- [ ] " out of habit, but the "- " triggers
// the bullet-list rule first, leaving the caret inside a bullet where the
// checkbox rule can't match. This rule fires on "[ ]"/"[x]" + space in either
// context: it lifts the item out of any surrounding bullet/ordered list (a no-op
// when there isn't one) and converts it to a task item, so both "- [ ] " and a
// bare "[ ] " produce a checklist. Higher priority than TaskList (100) so it
// wins over the built-in rule.
const TaskListMarkdownShortcut = Extension.create({
  name: "taskListMarkdownShortcut",
  priority: 200,
  addInputRules() {
    return [
      new InputRule({
        find: /^\s*\[([ xX]?)\]\s$/,
        handler: ({ range, match, chain }) => {
          const checked = match[1].toLowerCase() === "x";
          chain()
            .deleteRange(range)
            .liftListItem("listItem")
            .toggleTaskList()
            .updateAttributes("taskItem", { checked })
            .run();
        },
      }),
    ];
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
        // Clicking a link should place the caret so the link popover can appear,
        // not navigate away from the editor.
        link: { openOnClick: false },
      }),
      ParagraphWithBlankLines,
      CodeBlockWithLineNav.configure({ lowlight }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TaskListMarkdownShortcut,
      DeleteEmptyFirstBlock,
      Card,
      CardFront,
      CardBack,
      InlineMath,
      BlockMath,
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
        onUploadError: (message) =>
          toast.error("Image upload failed", { description: message }),
      }),
      CleanClipboardMarkdown,
      Markdown.configure({
        html: true,
        breaks: true,
        transformPastedText: true,
        // Serialize the selection as markdown on copy. Without this, copying
        // falls back to ProseMirror's default text serializer, which joins
        // every block with a blank line — so a tight bullet list comes out
        // with an empty line between each item.
        transformCopiedText: true,
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
      {editor && editable && (
        <>
          <MarkdownBubbleMenu editor={editor} />
          <MarkdownLinkMenu editor={editor} />
        </>
      )}
      <ImageLightbox
        src={lightboxSrc}
        alt={lightboxAlt}
        onOpenChange={handleLightboxOpenChange}
      />
    </div>
  );
};
