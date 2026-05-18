import React from "react";
import {
  IconCheck,
  IconCopy,
  IconExternalLink,
  IconEyeFilled,
  IconEyeOff,
  IconPinFilled,
  IconPinnedOff,
  IconSparklesFilled,
  IconTrashFilled,
} from "@tabler/icons-react";

import { type Item } from "@/lib/types";
import {
  ContextMenu as ContextMenuRoot,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  applyTemplate,
  type CopyPrompt,
  useCopyPrompts,
} from "@/lib/copy-prompts";

const AUTO_CLOSE_MS = 3000;

// Track-cursor-and-auto-close behaviour shared between the dropdown and the
// context menu — once the user clicks copy, we start a 3s timer when their
// cursor leaves the popup, and cancel when it re-enters. Using global
// mousemove + hit-testing is more reliable than mouseenter/leave which fires
// on every wobble across the popup boundary.
const useAutoCloseAfterCopy = ({
  open,
  copyTriggered,
  onClose,
}: {
  open: boolean;
  copyTriggered: boolean;
  onClose: () => void;
}) => {
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  });
  React.useEffect(() => {
    if (!open || !copyTriggered) return;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    const cancel = () => {
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
    };
    const start = () => {
      cancel();
      timerId = setTimeout(() => {
        onCloseRef.current();
      }, AUTO_CLOSE_MS);
    };

    const handleMove = (e: MouseEvent) => {
      const popups = document.querySelectorAll<HTMLElement>(
        '[data-slot="dropdown-menu-content"], [data-slot="dropdown-menu-sub-content"], [data-slot="context-menu-content"]',
      );
      if (popups.length === 0) return;
      const inside = Array.from(popups).some((popup) => {
        const rect = popup.getBoundingClientRect();
        return (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        );
      });
      if (inside) cancel();
      else if (!timerId) start();
    };

    document.addEventListener("mousemove", handleMove);
    return () => {
      document.removeEventListener("mousemove", handleMove);
      cancel();
    };
  }, [open, copyTriggered]);
};

type ItemMenuActionsProps = {
  item: Item;
  onTogglePin?: () => void;
  onToggleRead?: () => void;
  onDelete?: () => void;
};

// Internal hook returning the action handlers + visible-state needed to render
// the menu items. Used by both ItemDropdown and ItemContextMenu so that the
// underlying behaviour (copy feedback, prompts, etc.) stays consistent.
const useItemMenuActions = ({ item }: { item: Item }) => {
  const [prompts] = useCopyPrompts();
  const [lastCopied, setLastCopied] = React.useState<string | null>(null);
  const [copyTriggered, setCopyTriggered] = React.useState(false);

  const handleCopy = React.useCallback(
    (promptId: string, template: string) => {
      const output = applyTemplate(template, {
        title: item.title,
        url: item.url,
        id: item.id,
        notes: item.notes ?? "",
      });
      navigator.clipboard.writeText(output);
      setLastCopied(promptId);
      setTimeout(() => setLastCopied(null), 2000);
      setCopyTriggered(true);
    },
    [item.id, item.title, item.url, item.notes],
  );

  const handleCopyId = React.useCallback(() => {
    navigator.clipboard.writeText(item.id);
    setLastCopied("__id__");
    setTimeout(() => setLastCopied(null), 2000);
    setCopyTriggered(true);
  }, [item.id]);

  const handleOpenInNewTab = React.useCallback(() => {
    window.open(item.url, "_blank", "noopener,noreferrer");
  }, [item.url]);

  const canOpenUrl = !!item.url && URL.canParse(item.url);

  return {
    prompts,
    lastCopied,
    copyTriggered,
    setCopyTriggered,
    handleCopy,
    handleCopyId,
    handleOpenInNewTab,
    canOpenUrl,
  };
};

// Renders just the menu items (no Root/Popup/Content wrapper). Both the
// dropdown and context-menu wrappers use the same MenuPrimitive.Item under
// the hood (ContextMenuRoot creates Menu.Root internally), so DropdownMenu*
// items render correctly inside either context.
const ItemMenuItems = ({
  item,
  prompts,
  canOpenUrl,
  lastCopied,
  handleOpenInNewTab,
  handleCopyId,
  handleCopy,
  onTogglePin,
  onToggleRead,
  onDelete,
}: ItemMenuActionsProps & ReturnType<typeof useItemMenuActions>) => {
  const isRead = item.read;

  return (
    <>
      {canOpenUrl && (
        <OpenInNewTabItem
          url={item.url ?? ""}
          onOpen={handleOpenInNewTab}
        />
      )}
      {onTogglePin && (
        <DropdownMenuItem onClick={onTogglePin}>
          {item.starred ? <IconPinnedOff /> : <IconPinFilled />}
          {item.starred ? "Unpin" : "Pin"}
        </DropdownMenuItem>
      )}
      <Tooltip open={lastCopied === "__id__"}>
        <TooltipTrigger
          render={
            <DropdownMenuItem closeOnClick={false} onClick={handleCopyId}>
              <IconCopy />
              Copy ID
            </DropdownMenuItem>
          }
        />
        <TooltipContent side="right">Copied</TooltipContent>
      </Tooltip>
      {prompts.length > 0 && (
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <IconSparklesFilled />
            Prompts
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-w-72">
            {prompts.map((prompt) => (
              <PromptMenuItem
                key={prompt.id}
                prompt={prompt}
                isCopied={lastCopied === prompt.id}
                onCopy={handleCopy}
              />
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      )}
      {onToggleRead && (
        <DropdownMenuItem onClick={onToggleRead}>
          {isRead ? <IconEyeOff /> : <IconEyeFilled />}
          {isRead ? "Mark as unread" : "Mark as read"}
        </DropdownMenuItem>
      )}
      {onDelete && (
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <IconTrashFilled />
          Delete
        </DropdownMenuItem>
      )}
    </>
  );
};

export const ItemDropdown = ({
  item,
  open,
  onOpenChange,
  onTogglePin,
  onToggleRead,
  onDelete,
  children,
}: {
  item: Item;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onTogglePin?: () => void;
  onToggleRead?: () => void;
  onDelete?: () => void;
  children: React.ReactNode;
}) => {
  const actions = useItemMenuActions({ item });

  React.useEffect(() => {
    if (!open) actions.setCopyTriggered(false);
  }, [open, actions]);

  useAutoCloseAfterCopy({
    open: !!open,
    copyTriggered: actions.copyTriggered,
    onClose: () => onOpenChange?.(false),
  });

  const handleStopPropagation = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      {children}
      <DropdownMenuContent
        align="end"
        sideOffset={4}
        onClick={handleStopPropagation}
      >
        <ItemMenuItems
          item={item}
          onTogglePin={onTogglePin}
          onToggleRead={onToggleRead}
          onDelete={onDelete}
          {...actions}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const ItemContextMenu = ({
  item,
  onTogglePin,
  onToggleRead,
  onDelete,
  onOpenChange,
  children,
}: {
  item: Item;
  onTogglePin?: () => void;
  onToggleRead?: () => void;
  onDelete?: () => void;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) => {
  const [open, setOpenState] = React.useState(false);
  const actions = useItemMenuActions({ item });

  const setOpen = React.useCallback(
    (next: boolean) => {
      setOpenState(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  React.useEffect(() => {
    if (!open) actions.setCopyTriggered(false);
  }, [open, actions]);

  useAutoCloseAfterCopy({
    open,
    copyTriggered: actions.copyTriggered,
    onClose: () => setOpen(false),
  });

  return (
    <ContextMenuRoot open={open} onOpenChange={setOpen}>
      {children}
      <ContextMenuContent>
        <ItemMenuItems
          item={item}
          onTogglePin={onTogglePin}
          onToggleRead={onToggleRead}
          onDelete={onDelete}
          {...actions}
        />
      </ContextMenuContent>
    </ContextMenuRoot>
  );
};

export { ContextMenuTrigger as ItemContextMenuTrigger };

const PromptMenuItem = ({
  prompt,
  isCopied,
  onCopy,
}: {
  prompt: CopyPrompt;
  isCopied: boolean;
  onCopy: (id: string, template: string) => void;
}) => {
  const handleClick = React.useCallback(() => {
    onCopy(prompt.id, prompt.template);
  }, [onCopy, prompt.id, prompt.template]);

  const description = prompt.description ?? "";
  const hasDescription = description.trim().length > 0;

  return (
    <Tooltip open={isCopied}>
      <TooltipTrigger
        render={
          <DropdownMenuItem
            closeOnClick={false}
            onClick={handleClick}
            className={hasDescription ? "items-start" : undefined}
          >
            {hasDescription ? (
              <div className="flex flex-col">
                <span>{prompt.name}</span>
                <span className="text-[0.65rem] text-muted-foreground/70">
                  {description}
                </span>
              </div>
            ) : (
              prompt.name
            )}
          </DropdownMenuItem>
        }
      />
      <TooltipContent side="right">Copied</TooltipContent>
    </Tooltip>
  );
};

const OpenInNewTabItem = ({
  url,
  onOpen,
}: {
  url: string;
  onOpen: () => void;
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopyClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    },
    [url],
  );

  const stopPointerDown = React.useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <DropdownMenuItem
            onClick={onOpen}
            className="group/open-tab pr-1"
          >
            <IconExternalLink />
            <span className="flex-1">Open in new tab</span>
            <button
              type="button"
              aria-label={copied ? "Copied" : "Copy URL"}
              onPointerDown={stopPointerDown}
              onClick={handleCopyClick}
              className="ml-1 flex size-5 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:bg-secondary group-hover/open-tab:opacity-100 focus-visible:opacity-100"
            >
              {copied ? <IconCheck /> : <IconCopy />}
            </button>
          </DropdownMenuItem>
        }
      />
      <TooltipContent side="right" className="max-w-xs truncate block">
        {url}
      </TooltipContent>
    </Tooltip>
  );
};
