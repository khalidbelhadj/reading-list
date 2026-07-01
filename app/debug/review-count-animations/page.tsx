"use client";

import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// `t` scales every duration so a single slow-mode toggle controls the whole
// page. `slow=1` → production timings; `slow=4` → comfy to read side-by-side.
type Scale = (seconds: number) => number;

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
  Render: (props: { value: number | null; t: Scale }) => React.ReactNode;
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
    Render: ({ value, t }) => (
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
    Render: ({ value, t }) => (
      <AnimatePresence mode="popLayout" initial={false}>
        {value !== null && (
          <motion.div
            key={value}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: t(0.18), ease: "easeOut" }}
            className="origin-right text-muted-foreground"
          >
            {value}
          </motion.div>
        )}
      </AnimatePresence>
    ),
  },
  {
    id: "slide-right",
    name: "Slide in from right edge (push-aside)",
    description:
      "The button clips at its border, so the digit travels through the right padding area into its slot. Slot width grows 0 → auto, the digit translates x → 0, and a matching negative margin absorbs the button's gap-1.5 while empty.",
    Render: ({ value, t }) => (
      <AnimatePresence mode="popLayout" initial={false}>
        {value !== null && (
          <motion.div
            key={value}
            initial={{ width: 0, marginLeft: -6, opacity: 0, x: 20 }}
            animate={{ width: "auto", marginLeft: 0, opacity: 1, x: 0 }}
            exit={{ width: 0, marginLeft: -6, opacity: 0, x: 20 }}
            transition={{
              type: "tween",
              duration: t(0.25),
              ease: [0.4, 0, 0.2, 1],
            }}
            className="whitespace-nowrap text-muted-foreground"
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
    Render: ({ value, t }) => (
      <div className="relative grid h-4 min-w-2 place-items-center">
        <AnimatePresence mode="wait" initial={false}>
          {value === null ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: t(0.15) }}
              className="size-1.5 animate-pulse rounded-full bg-muted-foreground/40"
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
    Render: ({ value, t }) =>
      value === null ? null : <RollingNumber value={value} t={t} />,
  },
];

const RollingNumber = ({ value, t }: { value: number; t: Scale }) => {
  const digits = String(value).split("");
  return (
    <div className="flex text-muted-foreground tabular-nums">
      {digits.map((d, i) => (
        <RollingDigit key={`${digits.length}-${i}`} digit={Number(d)} t={t} />
      ))}
    </div>
  );
};

const RollingDigit = ({ digit, t }: { digit: number; t: Scale }) => {
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
    <Button variant="outline" size="sm" className="gap-1.5 overflow-hidden">
      Review
      {children}
    </Button>
  );
};

const Page = () => {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }
  // null = "loading", number = "ready"
  const [value, setValue] = React.useState<number | null>(null);
  const [slow, setSlow] = React.useState(true);
  const slowFactor = slow ? 4 : 1;
  const t: Scale = React.useCallback(
    (seconds) => seconds * slowFactor,
    [slowFactor],
  );

  const replay = React.useCallback(
    (nextValue: number) => {
      setValue(null);
      // Mimic a brief network delay so the loading state is observable.
      window.setTimeout(() => setValue(nextValue), t(0.35) * 1000);
    },
    [t],
  );

  // Auto-load on mount so first paint already shows a value entering.
  const didAutoLoad = React.useRef(false);
  React.useEffect(() => {
    if (didAutoLoad.current) return;
    didAutoLoad.current = true;
    replay(7);
  }, [replay]);

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-6 py-10">
      <header className="mb-8 flex flex-col gap-2">
        <h1 className="font-content text-2xl font-semibold">
          Review button count, entrance animations
        </h1>
        <p className="text-sm text-muted-foreground">
          Each row reloads independently. Use the controls to replay an entrance
          or swap to a different number, animations that depend on value
          transitions (scale-fade, rolling) replay on value change.
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-2">
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
          <div className="flex-1" />
          <Button
            size="sm"
            variant={slow ? "default" : "outline"}
            onClick={() => setSlow((s) => !s)}
            aria-pressed={slow}
          >
            Slow mode {slow ? "on" : "off"}
          </Button>
        </div>
      </header>

      <div className="flex flex-col divide-y divide-border">
        {VARIANTS.map((v) => (
          <div
            key={v.id}
            className="grid grid-cols-[1fr_auto] items-center gap-6 py-5"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <div className="text-sm font-medium">{v.name}</div>
              <div className="text-xs text-muted-foreground">
                {v.description}
              </div>
            </div>
            <ReviewButtonShell>{v.Render({ value, t })}</ReviewButtonShell>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Page;
