import type React from "react";

import { faviconSrc } from "@/lib/favicon";
import { cn } from "@/lib/utils";

import { WARMTH } from "./options";
import { slug } from "./outline";
import { Frame } from "./previews";

// Round three: favicon treatments. The same six sites in each candidate, on
// a sidebar-like frost column, light and dark.

const SITES = [
  [
    "Linux Container Primitives: cgroups, namespaces",
    "https://www.youtube.com/watch?v=x1npPrzyKfs",
  ],
  [
    "[1908.01262] A systematic review of fuzzing",
    "https://arxiv.org/abs/1908.01262",
  ],
  [
    "Sequential consistency",
    "https://en.wikipedia.org/wiki/Sequential_consistency",
  ],
  [
    "google/brotli: Brotli compression format",
    "https://github.com/google/brotli",
  ],
  [
    "Jane Street Blog: What a Jane Street dev does",
    "https://blog.janestreet.com/",
  ],
  [
    "How Media Molecule does serialization",
    "https://www.mediamolecule.com/blog",
  ],
  ["Optimizing a ring buffer for throughput", "https://rigtorp.se/ringbuffer/"],
] as const;

type Treatment = {
  key: string;
  label: string;
  note: string;
  size: number;
  className: string;
  style?: React.CSSProperties;
};

const TREATMENTS: Treatment[] = [
  {
    key: "bare",
    label: "A. Bare (chosen)",
    note: "The icon as served, nothing behind it. Transparent icons float.",
    size: 16,
    className: "rounded-[3px]",
  },
  {
    key: "tile",
    label: "B. Tile",
    note: "A 6% tile with 1px padding. Edge-to-edge icons get a frame; transparent ones a faint ground.",
    size: 16,
    className: "rounded-[4px] bg-foreground/[0.06] p-px",
  },
  {
    key: "chip",
    label: "C. Chip",
    note: "A solid surface-tone square, 2px padding. Every icon sits on the same opaque ground, so none feel missing.",
    size: 18,
    className: "rounded-[5px] bg-surface p-[2px]",
  },
  {
    key: "chip-hairline",
    label: "D. Chip with hairline",
    note: "The chip plus a 1px inset line, the way macOS frames small app icons in lists.",
    size: 18,
    className:
      "rounded-[5px] bg-surface p-[2px] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--foreground)_8%,transparent)]",
  },
  {
    key: "lifted",
    label: "E. Lifted",
    note: "Chip with a soft 1px drop shadow instead of a line; reads as a tiny app icon.",
    size: 18,
    className:
      "rounded-[5px] bg-surface p-[2px] shadow-[0_1px_2px_rgb(0_0_0/0.18)]",
  },
];

const Column = ({
  treatment,
  dark,
}: {
  treatment: Treatment;
  dark?: boolean;
}) => (
  <Frame
    tokens={dark ? WARMTH[0]?.dark : WARMTH[0]?.light}
    dark={dark}
    className="w-64 gap-0.5 p-2"
  >
    {SITES.map(([title, url]) => {
      const src = faviconSrc({ url });
      return (
        <div
          key={url}
          className="flex h-sidebar-row items-center gap-2 rounded-control px-2 text-body"
        >
          <span
            className={cn(
              "flex shrink-0 items-center justify-center overflow-hidden",
              treatment.className,
            )}
            style={{
              width: treatment.size,
              height: treatment.size,
              ...treatment.style,
            }}
          >
            {src && (
              <img
                src={src}
                alt=""
                className="h-full w-full object-contain"
                loading="lazy"
                decoding="async"
              />
            )}
          </span>
          <span className="fade-r min-w-0 flex-1 font-content">{title}</span>
        </div>
      );
    })}
  </Frame>
);

export const RoundThree = () => (
  <section
    id={slug("9. Favicons")}
    className="flex scroll-mt-14 flex-col gap-5"
  >
    <div className="flex flex-col gap-1">
      <h2 className="font-content text-lg font-semibold">9. Favicons</h2>
      <p className="max-w-prose text-sm text-muted-foreground">
        How a site icon sits in a row. Look at the YouTube and arXiv icons
        (transparent backgrounds) against Wikipedia and GitHub (solid); the
        question is whether every icon should stand on the same ground.
      </p>
    </div>
    <div className="grid gap-8">
      {TREATMENTS.map((treatment) => (
        <div key={treatment.key} className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{treatment.label}</span>
            <span className="text-xs text-muted-foreground">
              {treatment.note}
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            <Column treatment={treatment} />
            <Column treatment={treatment} dark />
          </div>
        </div>
      ))}
    </div>
  </section>
);
