"use client";

import React from "react";
import { AnimatePresence, motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Slow everything down ~4x for the demo so each variant's character is easy
// to read. Production values are listed in the in-page descriptions.
const SLOW = 4;
const t = (seconds: number) => seconds * SLOW;

type VariantId =
  | "baseline"
  | "fade-css"
  | "scale-fade"
  | "slide-right"
  | "skeleton-cross"
  | "rolling";

type VariantDef = {
  id: VariantId;
  name: string;
  description: string;
  Render: (props: { value: number | null }) => React.ReactNode;
};

// Each variant only renders the trailing count slot — the rest of the
// "Review N" button is shared. `value === null` means "still loading".
const VARIANTS: VariantDef[] = [
  {
    id: "baseline",
    name: "Baseline (pop in)",
    description:
      "Current behavior: the number snaps in once data arrives. The button width also jumps.",
    Render: ({ value }) =>
      value === null ? null : (
        <div className="text-muted-foreground">{value}</div>
      ),
  },
  {
    id: "fade-css",
    name: "Fade + reserved slot (CSS only)",
    description:
      "Slot is always present, just opacity 0 while loading. No width jump, calm but characterless.",
    Render: ({ value }) => (
      <div
        className={cn(
          "text-muted-foreground transition-opacity",
          value === null && "opacity-0",
        )}
        style={{ transitionDuration: `${t(0.2) * 1000}ms` }}
      >
        {value ?? 0}
      </div>
    ),
  },
  {
    id: "scale-fade",
    name: "Scale + fade from right (motion)",
    description:
      "Scales 0.6 → 1 and fades 0 → 1 anchored to the right edge. Replays on every value change because of key={value}.",
    Render: ({ value }) => (
      <AnimatePresence mode="popLayout" initial={false}>
        {value !== null && (
          <motion.div
            key={value}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: t(0.18), ease: "easeOut" }}
            className="text-muted-foreground origin-right"
          >
            {value}
          </motion.div>
        )}
      </AnimatePresence>
    ),
  },
  {
    id: "slide-right",
    name: "Width grows + fade (push-aside)",
    description:
      "Slot expands from 0 to auto width, absorbing the button's gap-1.5 via a matching negative margin so the button stays at exactly its 'Review' size until the digit has earned its space. Smooth, no phantom gap, no clip-popping.",
    Render: ({ value }) => (
      <AnimatePresence mode="popLayout" initial={false}>
        {value !== null && (
          <motion.div
            key={value}
            initial={{ width: 0, marginLeft: -6, opacity: 0 }}
            animate={{ width: "auto", marginLeft: 0, opacity: 1 }}
            exit={{ width: 0, marginLeft: -6, opacity: 0 }}
            transition={{ duration: t(0.25), ease: [0.4, 0, 0.2, 1] }}
            className="text-muted-foreground overflow-hidden whitespace-nowrap"
          >
            {value}
          </motion.div>
        )}
      </AnimatePresence>
    ),
  },
  {
    id: "skeleton-cross",
    name: "Skeleton dot → number",
    description:
      "Small pulsing dot while loading, crossfades to the number when ready. Linear-style. Strobes on fast queries.",
    Render: ({ value }) => (
      <div className="relative h-4 min-w-2 grid place-items-center">
        <AnimatePresence mode="wait" initial={false}>
          {value === null ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: t(0.15) }}
              className="size-1.5 rounded-full bg-muted-foreground/40 animate-pulse"
            />
          ) : (
            <motion.div
              key={`value-${value}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: t(0.18), ease: "easeOut" }}
              className="text-muted-foreground"
            >
              {value}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    ),
  },
  {
    id: "rolling",
    name: "Rolling digit (per-digit)",
    description:
      "Each digit is a small reel that scrolls to its value. Most expressive on count changes; can feel busy at >2 digits.",
    Render: ({ value }) =>
      value === null ? null : <RollingNumber value={value} />,
  },
];

const RollingNumber = ({ value }: { value: number }) => {
  const digits = String(value).split("");
  return (
    <div className="flex text-muted-foreground tabular-nums">
      {digits.map((d, i) => (
        <RollingDigit key={`${digits.length}-${i}`} digit={Number(d)} />
      ))}
    </div>
  );
};

const RollingDigit = ({ digit }: { digit: number }) => {
  // Each digit reel: a 10-row column inside a 1lh-tall window. Translate by
  // `digit * 1lh` so the right number lines up. (Percentages here would be
  // relative to the column's full 10lh height, which scrolls out of view.)
  return (
    <div className="relative inline-block h-[1lh] w-[0.6em] overflow-hidden text-center">
      <motion.div
        animate={{ y: `calc(${-digit} * 1lh)` }}
        transition={{ duration: t(0.3), ease: [0.4, 0, 0.2, 1] }}
        className="flex flex-col"
      >
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className="h-[1lh] leading-[1lh]">
            {i}
          </span>
        ))}
      </motion.div>
    </div>
  );
};

const ReviewButtonShell = ({ children }: { children: React.ReactNode }) => {
  return (
    <Button variant="outline" size="sm" className="gap-1.5">
      Review
      {children}
    </Button>
  );
};

const Page = () => {
  // null = "loading", number = "ready"
  const [value, setValue] = React.useState<number | null>(null);

  const replay = React.useCallback((nextValue: number) => {
    setValue(null);
    // Mimic a brief network delay so the loading state is observable.
    window.setTimeout(() => setValue(nextValue), t(0.35) * 1000);
  }, []);

  // Auto-load on mount so first paint already shows a value entering.
  React.useEffect(() => {
    replay(7);
  }, [replay]);

  return (
    <div className="min-h-dvh px-6 py-10 max-w-3xl mx-auto">
      <header className="mb-8 flex flex-col gap-2">
        <h1 className="font-content text-2xl font-semibold">
          Review button count — entrance animations
        </h1>
        <p className="text-sm text-muted-foreground">
          Each row reloads independently. Use the controls to replay an
          entrance or swap to a different number — animations that depend on
          value transitions (scale-fade, rolling) replay on value change.
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button size="sm" onClick={() => replay(7)}>
            Reload with 7
          </Button>
          <Button size="sm" variant="outline" onClick={() => replay(12)}>
            Reload with 12
          </Button>
          <Button size="sm" variant="outline" onClick={() => replay(99)}>
            Reload with 99
          </Button>
          <Button size="sm" variant="outline" onClick={() => replay(0)}>
            Reload with 0
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setValue(null)}>
            Force loading
          </Button>
        </div>
      </header>

      <div className="flex flex-col divide-y divide-border">
        {VARIANTS.map((v) => (
          <div
            key={v.id}
            className="grid grid-cols-[1fr_auto] items-center gap-6 py-5"
          >
            <div className="flex flex-col gap-1 min-w-0">
              <div className="text-sm font-medium">{v.name}</div>
              <div className="text-xs text-muted-foreground">
                {v.description}
              </div>
            </div>
            <ReviewButtonShell>{v.Render({ value })}</ReviewButtonShell>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Page;
