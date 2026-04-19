import React from "react";

import { type Item, isReadingListItem } from "@/lib/types";
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

export const ItemDropdown = ({
  item,
  open,
  onOpenChange,
  onToggleRead,
  onDelete,
  children,
}: {
  item: Item;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onToggleRead?: () => void;
  onDelete?: () => void;
  children: React.ReactNode;
}) => {
  const [prompts] = useCopyPrompts();
  const [lastCopied, setLastCopied] = React.useState<string | null>(null);
  const [copyTriggered, setCopyTriggered] = React.useState(false);
  const onOpenChangeRef = React.useRef(onOpenChange);
  React.useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  });

  React.useEffect(() => {
    if (!open) setCopyTriggered(false);
  }, [open]);

  // Once copy has been clicked, watch the cursor globally. Start a 3s timer
  // when the cursor is outside the popup's bounding rect; cancel when inside.
  // Using global mousemove + hit-testing is more reliable than mouseenter/leave
  // which fire on every wobble across the popup boundary.
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
        onOpenChangeRef.current?.(false);
      }, AUTO_CLOSE_MS);
    };

    const handleMove = (e: MouseEvent) => {
      const popups = document.querySelectorAll<HTMLElement>(
        '[data-slot="dropdown-menu-content"], [data-slot="dropdown-menu-sub-content"]',
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

  const isRead = isReadingListItem(item) && item.read;

  const handleStopPropagation = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleToggleRead = React.useCallback(() => {
    if (onToggleRead) onToggleRead();
  }, [onToggleRead]);

  const handleDelete = React.useCallback(() => {
    if (onDelete) onDelete();
  }, [onDelete]);

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      {children}
      <DropdownMenuContent
        align="end"
        sideOffset={4}
        onClick={handleStopPropagation}
      >
        <Tooltip open={lastCopied === "__id__"}>
          <TooltipTrigger
            render={
              <DropdownMenuItem closeOnClick={false} onClick={handleCopyId}>
                Copy ID
              </DropdownMenuItem>
            }
          />
          <TooltipContent side="right">Copied</TooltipContent>
        </Tooltip>
        {prompts.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Prompts</DropdownMenuSubTrigger>
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
        {onToggleRead && isReadingListItem(item) && (
          <DropdownMenuItem onClick={handleToggleRead}>
            {isRead ? "Mark as unread" : "Mark as read"}
          </DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem variant="destructive" onClick={handleDelete}>
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

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
