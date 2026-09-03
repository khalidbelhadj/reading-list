import { Favicon } from "@/components/app/favicon";
import { Flashcard } from "@/components/app/flashcard";
import { Button } from "@/components/system/button";
import { ButtonGroup } from "@/components/system/button-group";
import { Kbd } from "@/components/system/kbd";
import { Tooltip } from "@/components/system/tooltip";
import { type Rating } from "@/lib/srs";

import { type QueueCard } from "./review-queues";

export const RATINGS: Array<{ value: Rating; label: string; key: string }> = [
  { value: "again", label: "Again", key: "1" },
  { value: "hard", label: "Hard", key: "2" },
  { value: "good", label: "Good", key: "3" },
  { value: "easy", label: "Easy", key: "4" },
];

// The card on stage: its source line (clicking jumps to the card in the
// item's notes) and the flashcard itself, editable in place.
export const ReviewCard = ({
  card,
  revealed,
  onReveal,
  onPatch,
  onCommit,
  onOpenCardInNotes,
}: {
  card: QueueCard;
  revealed: boolean;
  onReveal: () => void;
  onPatch: (fields: { front?: string; back?: string }) => void;
  onCommit: () => void;
  onOpenCardInNotes?: (itemId: string, cardId: string) => void;
}) => (
  <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-3">
    {card.itemTitle && (
      <Tooltip content="Open in notes">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-1 w-fit max-w-full gap-1.5 px-1 font-normal text-muted-foreground"
          disabled={!card.itemId || !onOpenCardInNotes}
          onClick={() =>
            card.itemId && onOpenCardInNotes?.(card.itemId, card.id)
          }
        >
          <Favicon
            item={{ url: card.itemUrl ?? "", faviconUrl: card.itemFaviconUrl }}
            size={12}
          />
          <span className="min-w-0 truncate">{card.itemTitle}</span>
        </Button>
      </Tooltip>
    )}
    <Flashcard
      key={card.id}
      scale="review"
      front={card.front}
      back={card.back}
      revealed={revealed}
      onRevealedChange={(next) => {
        if (next) onReveal();
      }}
      onFrontChange={(front) => onPatch({ front })}
      onBackChange={(back) => onPatch({ back })}
      onCommit={onCommit}
    />
  </div>
);

// Grades anchor to the bottom centre; skip sits above them, available
// before and after the reveal. Renders its empty height when inactive so
// the stage doesn't jump.
export const ReviewControls = ({
  active,
  revealed,
  onSkip,
  onRate,
}: {
  active: boolean;
  revealed: boolean;
  onSkip: () => void;
  onRate: (rating: Rating) => void;
}) => (
  <div className="flex min-h-9 flex-col items-center justify-end gap-2">
    {active && (
      <Tooltip content="Set this card aside for now">
        <Button
          variant="ghost"
          className="text-muted-foreground"
          onClick={onSkip}
        >
          Skip
          <Kbd className="ml-0.5">S</Kbd>
        </Button>
      </Tooltip>
    )}
    {active && revealed && (
      <ButtonGroup>
        {RATINGS.map((rating) => (
          <Button
            key={rating.value}
            variant="secondary"
            onClick={() => onRate(rating.value)}
          >
            {rating.label}
            <Kbd className="ml-0.5">{rating.key}</Kbd>
          </Button>
        ))}
      </ButtonGroup>
    )}
  </div>
);
