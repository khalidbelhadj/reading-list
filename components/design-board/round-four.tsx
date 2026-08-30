import React from "react";

import { EditableText } from "@/components/system/editable-text";
import { cn } from "@/lib/utils";

import { slug } from "./outline";
import { Frame } from "./previews";

// Round four: the flashcard. One component worn three ways — review (big,
// reveal), list (compact), and inline in the markdown editor — with editing.
// Every candidate here is clickable: click to reveal, click text to edit.

const CARD = {
  front: "What does the MESI protocol's E (Exclusive) state guarantee?",
  back: "The line is present only in this cache and matches memory, so it can be written without a bus transaction.",
};

const SECOND = {
  front: "Why does a trigram index beat ILIKE for fuzzy search?",
  back: "It turns a substring scan into an index lookup over three-letter chunks, so cost tracks matches instead of table size.",
};

// ---------------------------------------------------------------------------
// A. Sheet: one quiet surface, the back unfolds beneath the front behind a
// hairline. No 3D, no mystery chrome; reading a card feels like reading a
// note. Editing is in place — the text is simply editable where it stands.

const SheetCard = ({
  scale = "review",
  editable = false,
}: {
  scale?: "review" | "list";
  editable?: boolean;
}) => {
  const [revealed, setRevealed] = React.useState(editable);
  const [front, setFront] = React.useState(CARD.front);
  const [back, setBack] = React.useState(CARD.back);

  return (
    <div
      onClick={() => !editable && setRevealed((prev) => !prev)}
      className={cn(
        "flex w-full flex-col rounded-surface bg-foreground/[0.03]",
        scale === "review" ? "gap-3 p-6" : "gap-2 p-4",
        !editable && "cursor-pointer select-none",
      )}
    >
      <EditableText
        multiline
        disabled={!editable}
        value={front}
        onChange={setFront}
        placeholder="Front"
        className={cn(
          "font-content font-medium",
          scale === "review" ? "text-title" : "text-body",
        )}
      />
      {revealed ? (
        <>
          <div className="h-px bg-foreground/10" />
          <EditableText
            multiline
            disabled={!editable}
            value={back}
            onChange={setBack}
            placeholder="Back"
            className={cn(
              "font-content text-muted-foreground",
              scale === "review" ? "text-body" : "text-small",
            )}
          />
        </>
      ) : (
        <span className="text-small text-muted-foreground/60 select-none">
          Show answer
        </span>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// B. Flip: a true two-sided card. The front is centered and alone; the card
// turns over to show the back. The most card-like, best at review scale.
// Editing flips it flat: both faces shown stacked, editable.

const FlipCard = ({
  scale = "review",
  editable = false,
}: {
  scale?: "review" | "list";
  editable?: boolean;
}) => {
  const [flipped, setFlipped] = React.useState(false);
  const [front, setFront] = React.useState(SECOND.front);
  const [back, setBack] = React.useState(SECOND.back);
  const minHeight = scale === "review" ? 160 : 96;

  if (editable) {
    return (
      <div className="flex w-full flex-col gap-2 rounded-surface bg-foreground/[0.03] p-5 shadow-surface">
        <EditableText
          multiline
          value={front}
          onChange={setFront}
          placeholder="Front"
          className="font-content text-body font-medium"
        />
        <div className="h-px bg-foreground/10" />
        <EditableText
          multiline
          value={back}
          onChange={setBack}
          placeholder="Back"
          className="font-content text-body text-muted-foreground"
        />
      </div>
    );
  }

  return (
    <div className="w-full" style={{ perspective: 1200 }}>
      <div
        onClick={() => setFlipped((prev) => !prev)}
        className="relative w-full cursor-pointer transition-transform duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] [transform-style:preserve-3d]"
        style={{
          minHeight,
          transform: flipped ? "rotateX(180deg)" : undefined,
        }}
      >
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center rounded-surface bg-surface p-6 text-center shadow-surface [backface-visibility:hidden]",
          )}
        >
          <span
            className={cn(
              "font-content font-medium",
              scale === "review" ? "text-title" : "text-body",
            )}
          >
            {front}
          </span>
        </div>
        <div
          className="absolute inset-0 flex items-center justify-center rounded-surface bg-surface p-6 text-center shadow-surface [backface-visibility:hidden]"
          style={{ transform: "rotateX(180deg)" }}
        >
          <span
            className={cn(
              "font-content text-muted-foreground",
              scale === "review" ? "text-body" : "text-small",
            )}
          >
            {back}
          </span>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// C. Veil: front and answer are both always present, the answer under a blur
// until asked. Dense, honest about structure, and collapses naturally to the
// list and editor scales. Editing lifts the veil and edits in place.

const VeilCard = ({
  scale = "review",
  editable = false,
}: {
  scale?: "review" | "list";
  editable?: boolean;
}) => {
  const [revealed, setRevealed] = React.useState(editable);
  const [front, setFront] = React.useState(CARD.front);
  const [back, setBack] = React.useState(CARD.back);

  return (
    <div
      onClick={() => !editable && setRevealed((prev) => !prev)}
      className={cn(
        "flex w-full flex-col rounded-control",
        scale === "review"
          ? "gap-2.5 rounded-surface bg-foreground/[0.03] p-6"
          : "gap-1.5 bg-foreground/[0.03] p-3",
        !editable && "cursor-pointer select-none",
      )}
    >
      <EditableText
        multiline
        disabled={!editable}
        value={front}
        onChange={setFront}
        placeholder="Front"
        className={cn(
          "font-content font-medium",
          scale === "review" ? "text-title" : "text-body",
        )}
      />
      <EditableText
        multiline
        disabled={!editable}
        value={back}
        onChange={setBack}
        placeholder="Back"
        className={cn(
          "font-content text-muted-foreground transition-[filter] duration-200",
          scale === "review" ? "text-body" : "text-small",
          !revealed && "blur-[5px] select-none",
        )}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------

type Candidate = {
  key: string;
  label: string;
  note: string;
  Card: typeof SheetCard;
};

const CANDIDATES: Candidate[] = [
  {
    key: "sheet",
    label: "A. Sheet (chosen)",
    note: "One quiet surface; the answer unfolds beneath a hairline. Editing is in place, no mode.",
    Card: SheetCard,
  },
  {
    key: "flip",
    label: "B. Flip",
    note: "A real two-sided card that turns over. Editing lays it flat: both faces stacked.",
    Card: FlipCard,
  },
  {
    key: "veil",
    label: "C. Veil",
    note: "Both sides always present, the answer blurred until asked. Densest; scales down furthest.",
    Card: VeilCard,
  },
];

const Column = ({
  candidate,
  dark,
}: {
  candidate: Candidate;
  dark?: boolean;
}) => {
  const { Card } = candidate;
  return (
    <Frame
      dark={dark}
      radiusControl="10px"
      radiusSurface="20px"
      className="w-105"
    >
      <p className="text-micro font-medium text-muted-foreground">
        Review (click the card)
      </p>
      <Card scale="review" />
      <p className="pt-2 text-micro font-medium text-muted-foreground">
        List, two cards
      </p>
      <div className="flex flex-col gap-1.5">
        <Card scale="list" />
        <Card scale="list" />
      </div>
      <p className="pt-2 text-micro font-medium text-muted-foreground">
        Editing (click the text)
      </p>
      <Card scale="list" editable />
    </Frame>
  );
};

export const RoundFour = () => (
  <section
    id={slug("10. Flashcards")}
    className="flex scroll-mt-14 flex-col gap-5"
  >
    <div className="flex flex-col gap-1">
      <h2 className="font-content text-lg font-semibold">10. Flashcards</h2>
      <p className="max-w-prose text-sm text-muted-foreground">
        The flashcard, worn three ways: review (big, reveal on click), the
        flashcard list (compact), and editing (for the list and the markdown
        editor&apos;s card nodes). Every card here is live: click to reveal or
        flip, and in the editing row click into the text.
      </p>
    </div>
    <div className="grid gap-10">
      {CANDIDATES.map((candidate) => (
        <div key={candidate.key} className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{candidate.label}</span>
            <span className="text-xs text-muted-foreground">
              {candidate.note}
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            <Column candidate={candidate} />
            <Column candidate={candidate} dark />
          </div>
        </div>
      ))}
    </div>
  </section>
);
