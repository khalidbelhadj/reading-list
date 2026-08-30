import { IconCheck, IconChevronDown, IconCopy } from "@tabler/icons-react";
import {
  NodeViewContent,
  type NodeViewProps,
  NodeViewWrapper,
} from "@tiptap/react";
import React from "react";
import { createPortal } from "react-dom";

import {
  CODE_LANGUAGES,
  labelForLanguage,
  normalizeLanguage,
} from "@/lib/lowlight";
import { cn } from "@/lib/utils";

import { Button } from "../button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "../menu";
import { Tooltip } from "../tooltip";

// The code block's toolbar (language picker + copy) is portaled to <body>,
// not rendered inside the node view: base-ui's menu marks everything outside
// its popup inert by walking up from the trigger and tagging ancestors'
// siblings, and if the trigger lived inside the editor those writes would
// land on ProseMirror's own nodes, which its DOM observer treats as content
// changes and rebuilds, tearing down the node view and the open menu with it.
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
  const [anchorHovered, setAnchorHovered] = React.useState(false);
  const [toolbarHovered, setToolbarHovered] = React.useState(false);
  const toolbarRef = React.useRef<HTMLDivElement>(null);

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

  // The toolbar overlays the block's top-right corner but is a separate fixed
  // element in <body>, so hovering it leaves the anchor; track both.
  React.useEffect(() => {
    const toolbarEl = toolbarRef.current;
    const enterAnchor = () => setAnchorHovered(true);
    const leaveAnchor = () => setAnchorHovered(false);
    const enterToolbar = () => setToolbarHovered(true);
    const leaveToolbar = () => setToolbarHovered(false);
    anchor.addEventListener("mouseenter", enterAnchor);
    anchor.addEventListener("mouseleave", leaveAnchor);
    toolbarEl?.addEventListener("mouseenter", enterToolbar);
    toolbarEl?.addEventListener("mouseleave", leaveToolbar);
    return () => {
      anchor.removeEventListener("mouseenter", enterAnchor);
      anchor.removeEventListener("mouseleave", leaveAnchor);
      toolbarEl?.removeEventListener("mouseenter", enterToolbar);
      toolbarEl?.removeEventListener("mouseleave", leaveToolbar);
    };
  }, [anchor]);

  // Follow the block with an rAF loop: it is position:fixed in <body>, and a
  // position-only shift (panel slide, scroll, reflow above) emits no event.
  // setRect no-ops when nothing moved, so a stationary block never re-renders.
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

  const visible = anchorHovered || toolbarHovered || open || copied;

  return createPortal(
    <div
      ref={toolbarRef}
      data-code-block-toolbar
      className={cn(
        "flex items-center gap-0.5 transition-opacity",
        !visible && "pointer-events-none opacity-0",
      )}
      style={{
        position: "fixed",
        top: rect.top + 4,
        left: rect.right - 4,
        transform: "translateX(-100%)",
        zIndex: 40,
      }}
    >
      <Menu open={open} onOpenChange={setOpen}>
        <MenuTrigger
          disabled={disabled}
          render={
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-0.5 px-1.5 text-micro"
            />
          }
        >
          {labelForLanguage(language)}
          <IconChevronDown className="size-3" />
        </MenuTrigger>
        <MenuContent align="end" className="max-h-64 overflow-y-auto">
          {CODE_LANGUAGES.map((lang) => (
            <MenuItem
              key={lang.value}
              onClick={() => onSelect(lang.value)}
              shortcut={
                lang.value === language ? (
                  <IconCheck className="size-3.5" />
                ) : undefined
              }
            >
              {lang.label}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
      <Tooltip content="Copied" open={copied}>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={copied ? "Copied" : "Copy code"}
          onClick={handleCopy}
        >
          {copied ? <IconCheck /> : <IconCopy />}
        </Button>
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
  // State, not a ref: the portaled toolbar mounts once the wrapper exists.
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
      <pre spellCheck={false}>
        <NodeViewContent<"code"> as="code" />
      </pre>
    </NodeViewWrapper>
  );
};
