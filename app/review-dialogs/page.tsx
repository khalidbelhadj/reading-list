"use client";

import React from "react";
import { notFound } from "next/navigation";
import {
  IconMinus,
  IconPlus,
  IconClock,
  IconCards,
} from "@tabler/icons-react";

import {
  AlertDialog,
  AlertDialogContent,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

const SECONDS_PER_CARD = 30;
const TOTAL_CARDS = 56;
const TOTAL_ITEMS = 11;

const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
};

const estimateFor = (count: number) =>
  formatDuration(count * SECONDS_PER_CARD);

// ---------------------------------------------------------------------------
// Variant A — Big time hero
// ---------------------------------------------------------------------------

const VariantHeroTime = ({ onClose }: { onClose: () => void }) => {
  const [count, setCount] = React.useState(5);
  return (
    <div className="flex flex-col gap-6 p-2">
      <div className="flex flex-col items-center gap-1 pt-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Estimated time
        </span>
        <span className="font-content text-5xl tabular-nums">
          {estimateFor(count)}
        </span>
        <span className="text-sm text-muted-foreground">
          {count} {count === 1 ? "card" : "cards"} · {TOTAL_CARDS} due
        </span>
      </div>
      <Slider
        min={1}
        max={TOTAL_CARDS}
        value={[count]}
        onValueChange={(v) => {
          const next = Array.isArray(v) ? v[0] : v;
          if (typeof next === "number") setCount(next);
        }}
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onClose}>Start review</Button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Variant B — Preset chips
// ---------------------------------------------------------------------------

const VariantPresets = ({ onClose }: { onClose: () => void }) => {
  const presets = [5, 10, 20, TOTAL_CARDS];
  const [count, setCount] = React.useState(5);
  return (
    <div className="flex flex-col gap-4 p-2">
      <div className="flex flex-col gap-1">
        <h2 className="font-content text-lg">Start review</h2>
        <p className="text-sm text-muted-foreground">
          {TOTAL_CARDS} cards due across {TOTAL_ITEMS} items.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {presets.map((preset) => {
          const isAll = preset === TOTAL_CARDS;
          const isSelected = count === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => setCount(preset)}
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-md px-4 py-3 text-left transition-colors",
                isSelected
                  ? "bg-secondary"
                  : "bg-card hover:bg-card/70",
              )}
            >
              <span className="font-content text-2xl tabular-nums">
                ~{estimateFor(preset)}
              </span>
              <span className="text-xs text-muted-foreground">
                {isAll ? `All ${preset} cards` : `${preset} cards`}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onClose}>Start · {count} cards</Button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Variant C — Stepper
// ---------------------------------------------------------------------------

const VariantStepper = ({ onClose }: { onClose: () => void }) => {
  const [count, setCount] = React.useState(5);
  const dec = () => setCount((c) => Math.max(1, c - 1));
  const inc = () => setCount((c) => Math.min(TOTAL_CARDS, c + 1));
  return (
    <div className="flex flex-col gap-5 p-2">
      <div className="flex flex-col gap-1">
        <h2 className="font-content text-lg">Start review</h2>
        <p className="text-sm text-muted-foreground">
          {TOTAL_CARDS} cards due
        </p>
      </div>
      <div className="flex items-center justify-center gap-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={dec}
          disabled={count === 1}
        >
          <IconMinus className="size-4" />
        </Button>
        <div className="flex flex-col items-center">
          <span className="font-content text-5xl tabular-nums leading-none">
            {count}
          </span>
          <span className="text-xs text-muted-foreground mt-1">
            {count === 1 ? "card" : "cards"}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={inc}
          disabled={count === TOTAL_CARDS}
        >
          <IconPlus className="size-4" />
        </Button>
      </div>
      <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
        <IconClock className="size-3.5" />
        <span>~{estimateFor(count)}</span>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onClose}>Start review</Button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Variant D — Two-stat with slider
// ---------------------------------------------------------------------------

const VariantTwoStat = ({ onClose }: { onClose: () => void }) => {
  const [count, setCount] = React.useState(5);
  return (
    <div className="flex flex-col gap-5 p-2">
      <h2 className="font-content text-lg">Start review</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 rounded-md bg-card px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <IconCards className="size-3.5" />
            Cards
          </div>
          <span className="font-content text-2xl tabular-nums">
            {count}
            <span className="text-sm text-muted-foreground">
              /{TOTAL_CARDS}
            </span>
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-md bg-card px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <IconClock className="size-3.5" />
            Time
          </div>
          <span className="font-content text-2xl tabular-nums">
            ~{estimateFor(count)}
          </span>
        </div>
      </div>
      <Slider
        min={1}
        max={TOTAL_CARDS}
        value={[count]}
        onValueChange={(v) => {
          const next = Array.isArray(v) ? v[0] : v;
          if (typeof next === "number") setCount(next);
        }}
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onClose}>Start review</Button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Variant E — Time-first slider
// ---------------------------------------------------------------------------

const VariantTimeFirst = ({ onClose }: { onClose: () => void }) => {
  const maxMinutes = Math.max(
    1,
    Math.round((TOTAL_CARDS * SECONDS_PER_CARD) / 60),
  );
  const [minutes, setMinutes] = React.useState(3);
  const count = Math.min(
    TOTAL_CARDS,
    Math.max(1, Math.round((minutes * 60) / SECONDS_PER_CARD)),
  );
  return (
    <div className="flex flex-col gap-5 p-2">
      <div className="flex flex-col gap-1">
        <h2 className="font-content text-lg">How long do you have?</h2>
        <p className="text-sm text-muted-foreground">
          {TOTAL_CARDS} cards due — pick a duration and we&rsquo;ll fit as
          many in as we can.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="font-content text-3xl tabular-nums">
            {minutes} min
          </span>
          <span className="text-sm text-muted-foreground tabular-nums">
            {count} {count === 1 ? "card" : "cards"}
          </span>
        </div>
        <Slider
          min={1}
          max={maxMinutes}
          value={[minutes]}
          onValueChange={(v) => {
            const next = Array.isArray(v) ? v[0] : v;
            if (typeof next === "number") setMinutes(next);
          }}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onClose}>Start review</Button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Variant F — Dot grid (visual cards)
// ---------------------------------------------------------------------------

const VariantDotGrid = ({ onClose }: { onClose: () => void }) => {
  const [count, setCount] = React.useState(5);
  return (
    <div className="flex flex-col gap-5 p-2">
      <div className="flex flex-col gap-1">
        <h2 className="font-content text-lg">Start review</h2>
        <p className="text-sm text-muted-foreground tabular-nums">
          {count} of {TOTAL_CARDS} cards · ~{estimateFor(count)}
        </p>
      </div>
      <div className="grid grid-cols-14 gap-1">
        {Array.from({ length: TOTAL_CARDS }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setCount(i + 1)}
            className={cn(
              "aspect-square rounded-[3px] transition-colors",
              i < count ? "bg-primary" : "bg-card hover:bg-card/60",
            )}
            aria-label={`Set to ${i + 1} cards`}
          />
        ))}
      </div>
      <Slider
        min={1}
        max={TOTAL_CARDS}
        value={[count]}
        onValueChange={(v) => {
          const next = Array.isArray(v) ? v[0] : v;
          if (typeof next === "number") setCount(next);
        }}
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onClose}>Start review</Button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Variant G — Inline minimal
// ---------------------------------------------------------------------------

const VariantInlineMinimal = ({ onClose }: { onClose: () => void }) => {
  const [count, setCount] = React.useState(5);
  return (
    <div className="flex flex-col gap-4 p-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-content text-xl tabular-nums">
          {count} {count === 1 ? "card" : "cards"}
        </span>
        <span className="text-sm text-muted-foreground tabular-nums">
          ~{estimateFor(count)}
        </span>
      </div>
      <Slider
        min={1}
        max={TOTAL_CARDS}
        value={[count]}
        onValueChange={(v) => {
          const next = Array.isArray(v) ? v[0] : v;
          if (typeof next === "number") setCount(next);
        }}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {TOTAL_CARDS} due
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={onClose}>
            Start
          </Button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------

type Variant = {
  id: string;
  name: string;
  description: string;
  render: (onClose: () => void) => React.ReactNode;
};

const VARIANTS: Variant[] = [
  {
    id: "hero-time",
    name: "Hero time",
    description: "Estimated time as the big number",
    render: (onClose) => <VariantHeroTime onClose={onClose} />,
  },
  {
    id: "presets",
    name: "Preset chips",
    description: "Tap a preset, time shown inline",
    render: (onClose) => <VariantPresets onClose={onClose} />,
  },
  {
    id: "stepper",
    name: "Stepper",
    description: "+/- around a big count",
    render: (onClose) => <VariantStepper onClose={onClose} />,
  },
  {
    id: "two-stat",
    name: "Two-stat",
    description: "Cards + time as twin tiles",
    render: (onClose) => <VariantTwoStat onClose={onClose} />,
  },
  {
    id: "time-first",
    name: "Time-first",
    description: "Pick duration, cards follow",
    render: (onClose) => <VariantTimeFirst onClose={onClose} />,
  },
  {
    id: "dot-grid",
    name: "Dot grid",
    description: "Each card is a dot",
    render: (onClose) => <VariantDotGrid onClose={onClose} />,
  },
  {
    id: "inline-minimal",
    name: "Inline minimal",
    description: "One row, slider, done",
    render: (onClose) => <VariantInlineMinimal onClose={onClose} />,
  },
];

const ReviewDialogsPlayground = () => {
  const [openId, setOpenId] = React.useState<string | null>(null);
  const open = VARIANTS.find((v) => v.id === openId) ?? null;

  return (
    <div className="min-h-dvh px-5 py-10">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-content text-xl">Start-review dialogs</h1>
          <p className="text-sm text-muted-foreground">
            Concepts for the &ldquo;start review&rdquo; dialog. Click a card to
            preview it as a modal. Each shows card count, estimated time, and
            a way to pick the session size.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {VARIANTS.map((variant) => (
            <button
              key={variant.id}
              type="button"
              onClick={() => setOpenId(variant.id)}
              className="flex flex-col items-start gap-1 rounded-lg bg-card p-5 text-left transition-colors hover:bg-card/70"
            >
              <span className="font-content text-base">{variant.name}</span>
              <span className="text-xs text-muted-foreground">
                {variant.description}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="font-content text-sm text-muted-foreground">
            Inline previews
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {VARIANTS.map((variant) => (
              <div
                key={variant.id}
                className="flex flex-col gap-2 rounded-lg bg-card p-4"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-content text-sm">{variant.name}</span>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setOpenId(variant.id)}
                  >
                    Open modal →
                  </button>
                </div>
                <div className="rounded-md bg-background p-3">
                  {variant.render(() => {})}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <AlertDialog
        open={openId !== null}
        onOpenChange={(o) => !o && setOpenId(null)}
      >
        <AlertDialogContent>
          {open?.render(() => setOpenId(null))}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const ReviewDialogsPage = () => {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }
  return <ReviewDialogsPlayground />;
};

export default ReviewDialogsPage;
