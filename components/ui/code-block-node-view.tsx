"use client";

import React from "react";
import { createPortal } from "react-dom";
import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { IconCheck, IconChevronDown, IconCopy } from "@tabler/icons-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CODE_LANGUAGES,
  labelForLanguage,
  normalizeLanguage,
} from "@/lib/lowlight";

// The toolbar (copy button + language picker) is portaled to <body>, not
// rendered inside the node view. When base-ui's menu opens, its
// FloatingFocusManager marks everything "outside" the
// popup inert (data-base-ui-inert / aria-hidden) by walking up from the trigger
// and tagging each ancestor's siblings. If the trigger lived inside the editor,
// that walk would write those attributes onto ProseMirror's own content nodes —
// the code block's <pre> and the sibling paragraphs. ProseMirror's DOM observer
// treats foreign attribute writes on the nodes it manages as content changes
// and rebuilds them, which destroys this React node view and the open menu with
// it (within the same frame the menu opened). Keeping the trigger in <body>
// means the walk only reaches the app root — an ancestor ProseMirror doesn't
// observe — so the editor DOM is never touched.
const CodeBlockToolbar = ({
  anchor,
  language,
  code,
  disabled,
  onSelect,
}: {
  anchor: HTMLElement;
  language: string;
  code: string;
  disabled: boolean;
  onSelect: (value: string) => void;
}) => {
  const [rect, setRect] = React.useState<DOMRect | null>(() =>
    anchor.getBoundingClientRect(),
  );
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const handleCopy = React.useCallback(() => {
    navigator.clipboard.writeText(code).then(
      () => setCopied(true),
      () => {},
    );
  }, [code]);

  React.useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timeout);
  }, [copied]);

  // Track the anchor's viewport position with an rAF loop. The toolbar is
  // position:fixed in <body> (see the comment above), so it has to follow the
  // block as the panel slides in, the editor scrolls, or content above reflows
  // while typing — none of which a ResizeObserver/scroll listener reliably
  // catches (a position-only shift emits no event). The loop is cheap:
  // getBoundingClientRect only forces a reflow when layout is already dirty,
  // and `setRect` no-ops when the rect is unchanged, so a stationary block
  // never re-renders.
  React.useLayoutEffect(() => {
    let raf = 0;
    const tick = () => {
      const next = anchor.getBoundingClientRect();
      setRect((prev) =>
        prev &&
        prev.top === next.top &&
        prev.left === next.left &&
        prev.right === next.right
          ? prev
          : next,
      );
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [anchor]);

  if (!rect) return null;

  return createPortal(
    <div
      data-code-block-toolbar
      className="flex items-center gap-0.5"
      style={{
        position: "fixed",
        top: rect.top + 6,
        left: rect.right - 6,
        transform: "translateX(-100%)",
        // Above the detail panel (a fixed, z-30 stacking context the editor
        // lives in) so the toolbar isn't painted behind the code block; below
        // the top layer (z-50: menus, dialogs, lightbox). The picker's own menu
        // is portaled at z-50 and still stacks above this.
        zIndex: 40,
      }}
    >
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          disabled={disabled}
          render={
            <button
              type="button"
              className="inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[0.7rem] whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus:text-foreground focus:outline-none data-popup-open:text-foreground"
            />
          }
        >
          {labelForLanguage(language)}
          <IconChevronDown className="size-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
          {CODE_LANGUAGES.map((lang) => (
            <DropdownMenuItem
              key={lang.value}
              onClick={() => onSelect(lang.value)}
            >
              {lang.label}
              {lang.value === language && (
                <IconCheck className="ml-auto size-3.5" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Tooltip open={copied}>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label={copied ? "Copied" : "Copy code"}
              onClick={handleCopy}
              className="inline-flex items-center rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus:text-foreground focus:outline-none"
            />
          }
        >
          {copied ? (
            <IconCheck className="size-3.5" />
          ) : (
            <IconCopy className="size-3.5" />
          )}
        </TooltipTrigger>
        <TooltipContent>Copied</TooltipContent>
      </Tooltip>
    </div>,
    document.body,
  );
};

export const CodeBlockNodeView = ({
  node,
  updateAttributes,
  editor,
}: NodeViewProps) => {
  const currentLanguage = normalizeLanguage(node.attrs.language);
  // Promote the wrapper element to state so the portaled toolbar mounts once
  // the node view's DOM exists (a ref alone wouldn't trigger the re-render).
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);

  const handleSelect = React.useCallback(
    (value: string) => {
      updateAttributes({ language: value === "plaintext" ? null : value });
    },
    [updateAttributes],
  );

  return (
    <NodeViewWrapper ref={setAnchor} className="code-block-node relative">
      {anchor && (
        <CodeBlockToolbar
          anchor={anchor}
          language={currentLanguage}
          code={node.textContent}
          disabled={!editor.isEditable}
          onSelect={handleSelect}
        />
      )}
      {/* Disable the browser's red spellcheck squiggles on code — spellcheck is
          inherited, so setting it on the <pre> covers the editable <code>. */}
      <pre spellCheck={false}>
        <NodeViewContent<"code"> as="code" />
      </pre>
    </NodeViewWrapper>
  );
};
