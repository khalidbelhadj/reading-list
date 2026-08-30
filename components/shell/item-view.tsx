import {
  IconDots,
  IconPencil,
  IconStar,
  IconStarFilled,
} from "@tabler/icons-react";
import React from "react";

import { Favicon } from "@/components/app/favicon";
import { flashcardExtensions } from "@/components/app/flashcard-node";
import { ItemMenuItems } from "@/components/app/item-menu";
import { Badge } from "@/components/system/badge";
import { Button } from "@/components/system/button";
import {
  Dialog,
  DialogActions,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/system/dialog";
import { EditableText } from "@/components/system/editable-text";
import { Input } from "@/components/system/input";
import { TextLink } from "@/components/system/link";
import { MarkdownEditor } from "@/components/system/markdown-editor";
import { Menu, MenuContent, MenuTrigger } from "@/components/system/menu";
import { notify } from "@/components/system/toast";
import { Tooltip } from "@/components/system/tooltip";
import { openChatWithClaude } from "@/lib/chat-with-claude";
import { uploadImage } from "@/lib/image-upload";
import { type Item } from "@/lib/types";
import { cn } from "@/lib/utils";

import { clipboardUrl, hostnameOf, useRetitleItem } from "./use-create-item";
import { useEditItem } from "./use-edit-item";
import { useItemActions } from "./use-item-actions";

// The cluster pinned to the pane's top-right corner: state badges (read,
// hidden from review), the star toggle, and the three-dot menu with the same
// action vocabulary as the row context menu. Rendered by the shell outside
// the scroll area so it stays put.
export const ItemViewActions = ({
  item,
  className,
  onEditLink,
  onReviewItem,
}: {
  item: Item;
  className?: string;
  onEditLink?: () => void;
  onReviewItem?: () => void;
}) => {
  const actions = useItemActions();
  return (
    <div className={cn("app-no-drag flex items-center gap-1.5", className)}>
      {item.hiddenFromReview && (
        <Tooltip content="Hidden from review">
          <Badge>Hidden</Badge>
        </Tooltip>
      )}
      {item.read && <Badge>Read</Badge>}
      <Tooltip content={item.starred ? "Unstar" : "Star"}>
        <Button
          variant="ghost"
          size="icon-md"
          aria-label={item.starred ? "Unstar" : "Star"}
          onClick={() => actions.toggleStar(item)}
        >
          {item.starred ? (
            <IconStarFilled className="text-starred" />
          ) : (
            <IconStar />
          )}
        </Button>
      </Tooltip>
      <Menu>
        <MenuTrigger
          render={
            <Button variant="ghost" size="icon-md" aria-label="Item actions" />
          }
        >
          <IconDots />
        </MenuTrigger>
        <MenuContent align="end">
          <ItemMenuItems
            item={item}
            onToggleRead={() => actions.toggleRead(item)}
            onToggleStar={() => actions.toggleStar(item)}
            onToggleHidden={() => actions.toggleHiddenFromReview(item)}
            onDelete={() => actions.removeItem(item)}
            onOpenLink={() => actions.openLink(item)}
            onCopyLink={() => actions.copyLink(item)}
            onEditLink={onEditLink}
            onReviewItem={onReviewItem}
            onChatWithClaude={() => openChatWithClaude(item)}
          />
        </MenuContent>
      </Menu>
    </div>
  );
};

const addedOn = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

// The selected item: its title, the date it was added, and its notes. Edits
// write through the ["items"] cache on every keystroke (the sidebar and lists
// follow live) and persist with a debounced save; see useEditItem.
// `urlEditRequest` is a counter the shell bumps when the corner menu asks for
// link editing (the menu lives outside this tree).
export const ItemView = ({
  item,
  urlEdit,
  cardFocus,
}: {
  item: Item;
  // Open the link dialog (from the corner menu or a row's context menu; the
  // nonce lets repeat requests re-open it).
  urlEdit?: { nonce: number };
  // Scroll to (and flash) this card once the editor has rendered it.
  cardFocus?: { cardId: string; nonce: number };
}) => {
  const { patch, flush } = useEditItem(item.id, item);
  const retitle = useRetitleItem();
  const setTitle = React.useCallback(
    (title: string) => patch({ title }),
    [patch],
  );
  const setNotes = React.useCallback(
    (notes: string) => patch({ notes }),
    [patch],
  );
  const commitTitle = React.useCallback(() => flush(), [flush]);
  // The link shows just the domain; the full url lives in its title and href.
  const domain = React.useMemo(() => {
    try {
      return new URL(item.url).hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  }, [item.url]);

  // URL editing happens in a small dialog (pencil, Add link, or the corner
  // menu's Edit link open it).
  const [editingUrl, setEditingUrl] = React.useState(false);
  const [urlDraft, setUrlDraft] = React.useState("");
  const startUrlEdit = React.useCallback(() => {
    setUrlDraft(item.url);
    setEditingUrl(true);
  }, [item.url]);
  const { mutate: runRetitle } = retitle;
  const commitUrl = React.useCallback(() => {
    setEditingUrl(false);
    const trimmed = urlDraft.trim();
    if (trimmed.length === 0 || trimmed === item.url) return;
    const url = clipboardUrl(trimmed);
    if (!url) {
      notify({
        tone: "error",
        title: "Invalid link",
        description: "Links must start with http:// or https://.",
      });
      return;
    }
    const previousTitle = item.title;
    patch({ url });
    flush();
    // If the title never became real (empty, or still the old hostname
    // fallback), fetch the new page's title in the background.
    if (!previousTitle.trim() || previousTitle === hostnameOf(item.url)) {
      runRetitle({ id: item.id, url, fallback: previousTitle });
    }
  }, [urlDraft, item.id, item.url, item.title, patch, flush, runRetitle]);

  // Jump to a specific card in the notes: the editor mounts asynchronously,
  // so poll briefly for the card node, then scroll and flash it.
  const rootRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!cardFocus) return;
    let cancelled = false;
    let attempts = 0;
    const tryScroll = () => {
      if (cancelled) return;
      const node = rootRef.current?.querySelector(
        `[data-card-id="${CSS.escape(cardFocus.cardId)}"]`,
      );
      if (node) {
        node.scrollIntoView({ block: "center" });
        node.classList.remove("x-card-flash");
        // Reflow so a repeated jump restarts the animation.
        void (node as HTMLElement).offsetWidth;
        node.classList.add("x-card-flash");
        return;
      }
      if (attempts++ < 40) setTimeout(tryScroll, 50);
    };
    tryScroll();
    return () => {
      cancelled = true;
    };
  }, [cardFocus]);

  // An edit-link request targeted at this item (possibly issued before this
  // view mounted, e.g. from a row's context menu elsewhere).
  const lastUrlEditRef = React.useRef(0);
  React.useEffect(() => {
    if (urlEdit && urlEdit.nonce !== lastUrlEditRef.current) {
      lastUrlEditRef.current = urlEdit.nonce;
      startUrlEdit();
    }
  }, [urlEdit, startUrlEdit]);

  return (
    <div
      ref={rootRef}
      className="mx-auto flex w-full max-w-xl flex-col gap-1 px-8 pt-12 pb-16"
    >
      {/* The favicon sits on the heading's first line only: it is placed
          absolutely and the text is indented past it, so wrapped lines run
          back under the icon as part of the title. */}
      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 flex h-6 items-center"
        >
          <Favicon item={item} size={18} />
        </span>
        <EditableText
          value={item.title}
          onChange={setTitle}
          onCommit={commitTitle}
          placeholder="Untitled"
          aria-label="Title"
          className="[text-indent:1.75rem] font-content text-heading font-semibold tracking-tight"
        />
      </div>
      <div className="group/meta flex min-h-5 items-center gap-3 text-small text-muted-foreground">
        <span className="shrink-0">Added {addedOn(item.createdAt)}</span>
        {domain ? (
          <>
            <TextLink
              variant="quiet"
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              title={item.url}
              className="min-w-0 truncate text-small"
            >
              {domain}
            </TextLink>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Edit link"
              onClick={startUrlEdit}
              className="-ml-2 hidden size-5 group-hover/meta:inline-flex"
            >
              <IconPencil />
            </Button>
          </>
        ) : (
          <TextLink
            variant="quiet"
            href="#"
            className="text-small"
            onClick={(event) => {
              event.preventDefault();
              startUrlEdit();
            }}
          >
            Add link
          </TextLink>
        )}
      </div>

      <Dialog
        open={editingUrl}
        onOpenChange={(open) => {
          if (!open) setEditingUrl(false);
        }}
      >
        <DialogContent>
          <DialogTitle className="text-title">
            {item.url ? "Edit link" : "Add link"}
          </DialogTitle>
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              commitUrl();
            }}
          >
            <Input
              autoFocus
              value={urlDraft}
              onChange={(event) => setUrlDraft(event.target.value)}
              placeholder="https://"
              aria-label="Link"
            />
            <DialogActions className="pt-0">
              <DialogClose render={<Button variant="ghost" />}>
                Cancel
              </DialogClose>
              <Button type="submit" variant="primary">
                Save
              </Button>
            </DialogActions>
          </form>
        </DialogContent>
      </Dialog>
      <MarkdownEditor
        value={item.notes ?? ""}
        onChange={setNotes}
        placeholder="Notes"
        className="pt-6"
        extensions={flashcardExtensions}
        onUploadImage={uploadImage}
      />
    </div>
  );
};
