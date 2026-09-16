import "./editor.css";

import { type Editor } from "@tiptap/core";
import React from "react";
import { createRoot } from "react-dom/client";

import { flashcardExtensions } from "@/components/app/flashcard-node";
import { MarkdownEditor } from "@/components/system/markdown-editor";
import {
  activeBlock,
  blockActions,
  markActions,
  selectFormatState,
} from "@/components/system/markdown-editor/actions";
import { normalizeHref } from "@/components/system/markdown-editor/shared";
import { Toaster } from "@/components/system/toast";

// The markdown editor as a page, for the native apps to host in a web view:
// the same tiptap editor as the web shell (math, code, cards, images, the
// bubble menu), with a small bridge instead of props. The host calls
// `window.editorHost` (value, placeholder, theme, focus, upload replies) and
// listens on the `editor` message handler (ready, change, height, upload).
// Built by `bun run build:editor` into the Mac app's resources.

type HostMessage =
  | { type: "ready" }
  | { type: "error"; message: string }
  | { type: "change"; value: string }
  | { type: "height"; value: number }
  | {
      // A text selection the host may float its own bubble over (null when
      // there is none, or it sits in a code block).
      type: "selection";
      rect: { x: number; y: number; width: number; height: number } | null;
      state: {
        bold: boolean;
        italic: boolean;
        underline: boolean;
        strike: boolean;
        code: boolean;
        link: boolean;
        href: string;
        block: string;
      } | null;
    }
  | {
      type: "upload";
      id: string;
      name: string;
      contentType: string;
      size: number;
      data: string;
    };

type EditorHost = {
  setValue: (value: string) => void;
  setPlaceholder: (placeholder: string) => void;
  setEditable: (editable: boolean) => void;
  setToolbar: (toolbar: boolean) => void;
  setTheme: (dark: boolean) => void;
  focus: () => void;
  resolveUpload: (id: string, src: string | null, error?: string) => void;
  // Run a formatting action by key (the bubble's vocabulary: marks, block
  // types, and "link" with an href to set or none to remove).
  run: (key: string, argument?: string | null) => void;
};

declare global {
  interface Window {
    editorHost?: EditorHost;
    webkit?: {
      messageHandlers?: {
        editor?: { postMessage: (message: HostMessage) => void };
      };
    };
  }
}

const send = (message: HostMessage) =>
  window.webkit?.messageHandlers?.editor?.postMessage(message);

const pendingUploads = new Map<
  string,
  { resolve: (src: string) => void; reject: (error: Error) => void }
>();

// What the host's bubble needs to know about the selection.
const reportSelection = (editor: Editor) => {
  const { from, to } = editor.state.selection;
  const text = editor.state.doc.textBetween(from, to).trim();
  const domSelection = window.getSelection();
  const range =
    domSelection && domSelection.rangeCount > 0
      ? domSelection.getRangeAt(0)
      : null;
  const box = range?.getBoundingClientRect();
  const showable =
    editor.isEditable &&
    from !== to &&
    text.length > 0 &&
    !editor.isActive("codeBlock") &&
    !!box;
  if (!showable || !box) {
    send({ type: "selection", rect: null, state: null });
    return;
  }
  const state = selectFormatState({ editor });
  send({
    type: "selection",
    rect: { x: box.x, y: box.y, width: box.width, height: box.height },
    state: {
      bold: state.bold,
      italic: state.italic,
      underline: state.underline,
      strike: state.strike,
      code: state.code,
      link: state.link,
      href: state.href,
      block: activeBlock(blockActions(editor, state)).key,
    },
  });
};

const runAction = (editor: Editor, key: string, argument?: string | null) => {
  if (key === "link") {
    const href = normalizeHref(argument ?? "");
    const chain = editor.chain().focus().extendMarkRange("link");
    if (href) chain.setLink({ href }).run();
    else chain.unsetLink().run();
    return;
  }
  const state = selectFormatState({ editor });
  const action = [
    ...markActions(editor, state),
    ...blockActions(editor, state),
  ].find((candidate) => candidate.key === key);
  action?.run();
};

const EditorPage = () => {
  const [value, setValue] = React.useState("");
  const [placeholder, setPlaceholder] = React.useState("");
  const [editable, setEditable] = React.useState(true);
  const [toolbar, setToolbar] = React.useState(false);
  const [editor, setEditor] = React.useState<Editor | null>(null);

  React.useEffect(() => {
    if (!editor) return;
    const report = () => reportSelection(editor);
    // A blur keeps the selection (the host's bubble may be what took the
    // click); only a collapsed selection hides the bubble.
    editor.on("selectionUpdate", report);
    editor.on("transaction", report);
    if (window.editorHost)
      window.editorHost.run = (key, argument) =>
        runAction(editor, key, argument);
    return () => {
      editor.off("selectionUpdate", report);
      editor.off("transaction", report);
    };
  }, [editor]);

  React.useEffect(() => {
    window.editorHost = {
      setValue,
      setPlaceholder,
      setEditable,
      setToolbar,
      setTheme: (dark) =>
        document.documentElement.classList.toggle("dark", dark),
      focus: () => document.querySelector<HTMLElement>(".ProseMirror")?.focus(),
      run: () => {},
      resolveUpload: (id, src, error) => {
        const pending = pendingUploads.get(id);
        pendingUploads.delete(id);
        if (!pending) return;
        if (src) pending.resolve(src);
        else pending.reject(new Error(error ?? "Upload failed"));
      },
    };
    // Before the host says otherwise, follow the system appearance.
    document.documentElement.classList.toggle(
      "dark",
      matchMedia("(prefers-color-scheme: dark)").matches,
    );
    // The host sizes the web view to the content.
    const observer = new ResizeObserver(() =>
      send({ type: "height", value: document.documentElement.scrollHeight }),
    );
    observer.observe(document.body);
    send({ type: "ready" });
    return () => observer.disconnect();
  }, []);

  const handleChange = React.useCallback((next: string) => {
    setValue(next);
    send({ type: "change", value: next });
  }, []);

  // Images cross the bridge as base64; the host uploads them through the
  // API and answers with the url to embed.
  const uploadImage = React.useCallback(
    (file: File) =>
      new Promise<string>((resolve, reject) => {
        const id = crypto.randomUUID();
        pendingUploads.set(id, { resolve, reject });
        const reader = new FileReader();
        reader.onerror = () => {
          pendingUploads.delete(id);
          reject(new Error("Could not read the image"));
        };
        reader.onload = () => {
          const data = String(reader.result).split(",")[1] ?? "";
          send({
            type: "upload",
            id,
            name: file.name,
            contentType: file.type,
            size: file.size,
            data,
          });
        };
        reader.readAsDataURL(file);
      }),
    [],
  );

  return (
    <>
      <MarkdownEditor
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        editable={editable}
        toolbar={toolbar}
        extensions={flashcardExtensions}
        onUploadImage={uploadImage}
        contentClassName="px-4 py-3"
        bubble={false}
        onEditor={setEditor}
      />
      <Toaster />
    </>
  );
};

window.addEventListener("error", (event) =>
  send({ type: "error", message: String(event.message) }),
);
window.addEventListener("unhandledrejection", (event) =>
  send({ type: "error", message: String(event.reason) }),
);

const root = document.getElementById("root");
if (root) createRoot(root).render(<EditorPage />);
