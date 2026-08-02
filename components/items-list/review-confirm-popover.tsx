// Start-a-review confirmation, anchored to whatever launched it — the toolbar's
// review buttons or the menu item that was clicked. Matches the "End session"
// popover in the review screen so both ends of a session use the same surface
// rather than a modal at one end and a popover at the other.
import type { ReviewMode } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverFooter,
  PopoverHeader,
  PopoverTitle,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";

const pluralize = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

export const ReviewConfirmPopover = ({
  open,
  onOpenChange,
  anchor,
  align = "end",
  mode,
  cardCount,
  itemCount,
  itemScoped = false,
  onConfirm,
  isStarting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: React.ComponentProps<typeof PopoverContent>["anchor"];
  align?: React.ComponentProps<typeof PopoverContent>["align"];
  mode: ReviewMode | null;
  cardCount: number;
  itemCount: number;
  itemScoped?: boolean;
  onConfirm: () => void;
  isStarting: boolean;
}) => {
  const isCram = mode === "cram";
  const isNew = mode === "new";
  const isEmpty = cardCount === 0;

  const title = isEmpty
    ? isNew
      ? "No new cards"
      : isCram
        ? "No cards to cram"
        : "No cards due"
    : isCram
      ? "Start cram session?"
      : isNew
        ? "Start new cards session?"
        : "Start review?";

  const description = isEmpty
    ? isNew
      ? itemScoped
        ? "All of this item’s cards have been introduced."
        : "All your cards have been introduced. New cards will appear as you add flashcards to items."
      : isCram
        ? itemScoped
          ? "This item has no flashcards yet."
          : "There are no flashcards yet. Add flashcards to your items to start cramming."
        : itemScoped
          ? "None of this item’s cards are due right now."
          : "You’re all caught up! Cards will become due again as their review intervals expire."
    : itemScoped
      ? isNew
        ? `${pluralize(cardCount, "new card")} in this item.`
        : isCram
          ? `${pluralize(cardCount, "card")} in this item.`
          : `${pluralize(cardCount, "card")} due in this item.`
      : `${pluralize(cardCount, "card")} due across ${pluralize(itemCount, "item")}.`;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverContent anchor={anchor} align={align} side="bottom">
        <PopoverHeader>
          <PopoverTitle>{title}</PopoverTitle>
          <PopoverDescription>
            {description}
            {!isEmpty && isCram && (
              <> Cram sessions don&rsquo;t affect your schedule.</>
            )}
          </PopoverDescription>
        </PopoverHeader>
        <PopoverFooter>
          {isEmpty ? (
            <PopoverClose>OK</PopoverClose>
          ) : (
            <>
              <PopoverClose disabled={isStarting}>Cancel</PopoverClose>
              <Button onClick={onConfirm} disabled={isStarting}>
                {isStarting && <Spinner className="size-3" />}
                {isCram
                  ? "Start cram"
                  : isNew
                    ? "Start new cards"
                    : "Start review"}
              </Button>
            </>
          )}
        </PopoverFooter>
      </PopoverContent>
    </Popover>
  );
};
