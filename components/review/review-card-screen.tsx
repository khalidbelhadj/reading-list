import { IconFileFilled } from "@tabler/icons-react";
import React from "react";

import type { ReviewSessionCard } from "@/app/actions";
import { MarkdownEditor } from "@/components/editor/markdown-editor";
import { getFaviconSrc } from "@/components/items-list/utils";
import { Button } from "@/components/ui/button";
import Image from "@/components/ui/image";
import { Kbd } from "@/components/ui/kbd";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverFooter,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { openItemInOriginWindow } from "@/lib/app-windows";
import { intervalShort } from "@/lib/format-time";
import { parseCardState, type Rating, schedule } from "@/lib/srs";
import { cn } from "@/lib/utils";

import { RATINGS } from "./ratings";

// The in-progress review screen: progress header with the end-session
// popover, the card's source-item meta row, front/back content, and the
// reveal/rating footer.

const safeHostname = (url: string): string | null => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};

// What the rating buttons preview: the interval the card would get if rated
// `rating` right now.
const nextIntervalLabel = (
  card: ReviewSessionCard,
  rating: Rating,
  nowIso: string,
): string => {
  const next = schedule(
    {
      state: parseCardState(card.state),
      interval: card.interval,
      easeFactor: card.easeFactor,
      reps: card.reps,
      lapses: card.lapses,
      due: card.due,
    },
    rating,
    nowIso,
  );
  return intervalShort(next.due, nowIso);
};

export const ReviewCardScreen = ({
  card,
  currentIndex,
  cardCount,
  revealed,
  ratePending,
  endPending,
  endConfirmOpen,
  onEndConfirmOpenChange,
  onConfirmEnd,
  onReveal,
  onRate,
}: {
  card: ReviewSessionCard;
  currentIndex: number;
  cardCount: number;
  revealed: boolean;
  ratePending: boolean;
  endPending: boolean;
  endConfirmOpen: boolean;
  onEndConfirmOpenChange: (open: boolean) => void;
  onConfirmEnd: () => void;
  onReveal: () => void;
  onRate: (rating: Rating) => void;
}) => {
  // Hand the item back to the window that opened this review (or open it
  // here when the review is running standalone).
  const handleShowItem = React.useCallback((targetItemId: string) => {
    openItemInOriginWindow(targetItemId);
  }, []);

  const favicon = card.itemUrl
    ? getFaviconSrc({
        url: card.itemUrl,
        faviconUrl: card.itemFaviconUrl ?? null,
      })
    : null;

  const itemDomain = card.itemUrl ? safeHostname(card.itemUrl) : null;

  const itemId = card.itemId;

  const metaContent = (
    <>
      {favicon ? (
        <Image
          src={favicon}
          alt=""
          width={14}
          height={14}
          className="size-3.5 rounded-[3px]"
          unoptimized
        />
      ) : (
        <IconFileFilled className="size-3.5" />
      )}
      {card.itemTitle && <span className="italic">{card.itemTitle}</span>}
      {itemDomain && <span>· {itemDomain}</span>}
    </>
  );

  const nowIso = new Date().toISOString();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="electron-top-bar-inset sticky top-0 z-10 bg-background pt-3 pb-2">
        <div className="mx-auto flex h-7 w-full max-w-3xl items-center gap-4 px-6 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {currentIndex + 1} of {cardCount}
          </span>
          <div className="flex flex-1 items-center gap-1">
            {Array.from({ length: cardCount }, (_, i) => (
              <div
                key={i}
                className={cn(
                  "h-0.5 flex-1 rounded-full",
                  i < currentIndex
                    ? "bg-primary"
                    : i === currentIndex
                      ? "animate-pulse bg-primary/60"
                      : "bg-border",
                )}
              />
            ))}
          </div>
          <Popover open={endConfirmOpen} onOpenChange={onEndConfirmOpenChange}>
            <PopoverTrigger
              disabled={endPending}
              // Raw button, not shadcn Button: this sits inline in the header
              // row as plain text with a color-only hover, no padding or
              // background — Button's chrome (fixed height, bg, border-radius)
              // would break that inline-text look.
              render={
                <button
                  type="button"
                  className="flex items-center gap-1.5 transition-colors hover:text-foreground disabled:opacity-60"
                />
              }
            >
              End session
            </PopoverTrigger>
            <PopoverContent align="end" side="bottom" sideOffset={8}>
              <PopoverHeader>
                <PopoverTitle>End this session?</PopoverTitle>
                <PopoverDescription>
                  You&rsquo;ve reviewed {currentIndex} of {cardCount} cards. You
                  can&rsquo;t resume this session, so ending it now will finish
                  it for good.
                </PopoverDescription>
              </PopoverHeader>
              <PopoverFooter>
                <PopoverClose disabled={endPending}>Keep going</PopoverClose>
                <Button
                  variant="destructive"
                  onClick={onConfirmEnd}
                  disabled={endPending}
                >
                  {endPending && <Spinner className="size-3" />}
                  End session
                </Button>
              </PopoverFooter>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 pb-6">
        <main className="flex flex-1 flex-col justify-center py-12">
          <div className="flex flex-col gap-6">
            {(card.itemTitle || itemDomain) &&
              (itemId ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="xs"
                        className="-mx-1.5 h-auto w-fit gap-2 px-1.5 py-1 text-xs font-normal text-muted-foreground"
                        onClick={() => handleShowItem(itemId)}
                      >
                        {metaContent}
                      </Button>
                    }
                  />
                  <TooltipContent>Show in list</TooltipContent>
                </Tooltip>
              ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {metaContent}
                </div>
              ))}

            <div className="font-content">
              <MarkdownEditor
                value={card.front}
                editable={false}
                className="[&_.ProseMirror]:text-2xl! [&_.ProseMirror]:leading-snug"
              />
            </div>

            {revealed && (
              <>
                <div className="border-t border-border" />
                <div className="font-content">
                  <MarkdownEditor
                    value={card.back}
                    editable={false}
                    className="text-foreground [&_.ProseMirror]:text-xl! [&_.ProseMirror]:leading-relaxed"
                  />
                </div>
              </>
            )}
          </div>
        </main>

        <footer className="flex items-center justify-end gap-3">
          {revealed ? (
            <div className="flex items-center gap-2">
              {RATINGS.map((r) => (
                <Button
                  key={r.value}
                  size="lg"
                  variant={r.value === "again" ? "destructive" : "outline"}
                  onClick={() => onRate(r.value)}
                  disabled={ratePending}
                  className="gap-2"
                >
                  <span className="font-medium">{r.label}</span>
                  <span
                    className={cn(
                      "text-[0.6875rem]",
                      r.value === "again"
                        ? "text-destructive/70"
                        : "text-muted-foreground",
                    )}
                  >
                    {nextIntervalLabel(card, r.value, nowIso)}
                  </span>
                  <Kbd
                    variant={r.value === "again" ? "destructive" : "default"}
                    size="xs"
                  >
                    {r.key}
                  </Kbd>
                </Button>
              ))}
            </div>
          ) : (
            <Button size="lg" onClick={onReveal} className="gap-2">
              Reveal answer
              <Kbd variant="primary" size="xs">
                Space
              </Kbd>
            </Button>
          )}
        </footer>
      </div>
    </div>
  );
};
