import React from "react";
import { Node } from "@tiptap/core";
import { type Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { useQuery } from "@tanstack/react-query";
import { IconFileFilled } from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { type Item } from "@/lib/types";
import { fetchItems } from "@/lib/queries";
import { openItemInPanel } from "@/lib/app-windows";
import { getFaviconSrc } from "@/components/items-list/utils";

// Inline atom node linking to another reading-list item (inserted by typing
// "@" in the editor — see item-link-suggestion.ts / item-link-menu.tsx).
// Serializes to a plain markdown link on the readinglist://item/<id> scheme
// (the same scheme the Electron deep-link protocol uses), so notes stay valid
// markdown and no backend registration is needed yet. The label attr is a
// snapshot of the title at insert time; the node view prefers the live title
// from the ["items"] cache so renames show through.

export const ITEM_LINK_SCHEME = "readinglist://item/";

const ItemLinkView = ({ node, selected }: NodeViewProps) => {
  const itemId = String(node.attrs.itemId);
  const label = String(node.attrs.label);

  const { data: item } = useQuery({
    queryKey: ["items"],
    queryFn: fetchItems,
    select: (items: Item[]) =>
      items.find((candidate) => candidate.id === itemId),
  });

  const handleClick = React.useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      openItemInPanel(itemId);
    },
    [itemId],
  );

  const title = item?.title.trim() || label || "Untitled";
  const faviconSrc = item ? getFaviconSrc(item) : null;

  return (
    <NodeViewWrapper as="span" className="inline">
      <span
        role="link"
        tabIndex={-1}
        data-item-link=""
        onClick={handleClick}
        className={cn(
          "cursor-pointer rounded-sm font-medium underline decoration-muted-foreground/40 underline-offset-2 hover:decoration-muted-foreground",
          selected && "bg-accent",
        )}
      >
        {faviconSrc ? (
          // Class-based styling (not Tailwind utilities): the editor's generic
          // `.ProseMirror img` rule for content images sets display:block +
          // border and outranks single-class utilities, so the favicon needs
          // an equally specific override in globals.css.
          <img src={faviconSrc} alt="" className="item-link-favicon" />
        ) : (
          <IconFileFilled className="mr-1 inline size-3.5 align-[-2px] text-muted-foreground" />
        )}
        {title}
      </span>
    </NodeViewWrapper>
  );
};

type MarkdownSerializeState = {
  write: (content: string) => void;
  esc: (text: string) => string;
};

export const ItemLink = Node.create({
  name: "itemLink",
  inline: true,
  group: "inline",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      itemId: { default: "" },
      label: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: `a[href^="${ITEM_LINK_SCHEME}"]`,
        // Above the Link mark's a[href] rule (default 50) so item links parse
        // as this node instead of a generic link.
        priority: 100,
        getAttrs: (element) => {
          const href = element.getAttribute("href") ?? "";
          const itemId = decodeURIComponent(
            href.slice(ITEM_LINK_SCHEME.length),
          );
          if (!itemId) return false;
          return { itemId, label: element.textContent ?? "" };
        },
      },
    ];
  },

  renderHTML({ node }) {
    return [
      "a",
      {
        href: `${ITEM_LINK_SCHEME}${String(node.attrs.itemId)}`,
        "data-item-link": "",
      },
      String(node.attrs.label),
    ];
  },

  renderText({ node }) {
    return String(node.attrs.label);
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: MarkdownSerializeState, node: ProseMirrorNode) {
          const label = String(node.attrs.label) || "Untitled";
          state.write(
            `[${state.esc(label)}](${ITEM_LINK_SCHEME}${String(node.attrs.itemId)})`,
          );
        },
        parse: {},
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ItemLinkView);
  },
});
