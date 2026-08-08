// Semantic search for the top bar. Rather than rendering its own result list,
// this narrows the table itself: matching items only, ranked by score, with
// the Match / Matched text columns revealed. That keeps the page one thing —
// a table — and lets a search compose with the sidebar facets ("of the things
// that mean X, which failed to embed?").
import { IconAdjustmentsHorizontal, IconX } from "@tabler/icons-react";
import React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type SearchTuning = {
  // Drop hits below this cosine similarity. Embeddings rarely score below
  // ~0.2 for unrelated text, so the useful band is roughly 0.2–0.6.
  minSimilarity: number;
  // Chunks the vector index returns before per-item collapsing. The action
  // caps this at 100 (limitSchema).
  maxChunks: number;
};

export const DEFAULT_TUNING: SearchTuning = {
  minSimilarity: 0.25,
  maxChunks: 50,
};

const TuningSlider = ({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex items-baseline justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-xs tabular-nums">{display}</span>
    </div>
    <Slider
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(next) => {
        const first = Array.isArray(next) ? next[0] : next;
        if (typeof first === "number") onChange(first);
      }}
    />
  </div>
);

export const SearchBar = ({
  query,
  onQueryChange,
  tuning,
  onTuningChange,
  searching,
  results,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  tuning: SearchTuning;
  onTuningChange: (tuning: SearchTuning) => void;
  searching: boolean;
  // Null while there's no settled search to report on.
  results: number | null;
}) => {
  // Local draft so typing doesn't fire an embedding call per keystroke — the
  // query commits on Enter (each search costs a provider round-trip).
  const [draft, setDraft] = React.useState(query);
  React.useEffect(() => setDraft(query), [query]);

  const clear = React.useCallback(() => {
    setDraft("");
    onQueryChange("");
  }, [onQueryChange]);

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = event.target.value;
      setDraft(next);
      // Emptying the field resets the results immediately, without needing a
      // second Enter to un-search.
      if (next === "") onQueryChange("");
    },
    [onQueryChange],
  );

  return (
    <div className="flex items-center gap-1.5">
      {results && (
        <>
          <span className="text-xs text-muted-foreground tabular-nums">
            {results} {results === 1 ? "match" : "matches"}
          </span>
        </>
      )}
      <div className="group/search relative w-72">
        <Input
          value={draft}
          onChange={handleChange}
          onKeyDown={(event) => {
            if (event.key === "Enter") onQueryChange(draft.trim());
            if (event.key === "Escape") clear();
          }}
          placeholder="Semantic search, press Enter"
          className="pr-12"
        />
        {/* Controls live inside the field, revealed on hover or focus (and kept
            visible whenever a search is active, so clear is always reachable). */}
        <div
          className={cn(
            "absolute inset-y-0 right-1 flex items-center gap-0.5 opacity-0 transition-opacity",
            "group-focus-within/search:opacity-100 group-hover/search:opacity-100",
            (query || searching) && "opacity-100",
          )}
        >
          {searching && <Spinner />}
          {query && !searching && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={clear}
              aria-label="Clear search"
            >
              <IconX />
            </Button>
          )}
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Search tuning"
                />
              }
            >
              <IconAdjustmentsHorizontal />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64">
              <div className="flex flex-col gap-4">
                <TuningSlider
                  label="Min similarity"
                  value={tuning.minSimilarity}
                  display={tuning.minSimilarity.toFixed(2)}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(minSimilarity) =>
                    onTuningChange({ ...tuning, minSimilarity })
                  }
                />
                <TuningSlider
                  label="Chunks searched"
                  value={tuning.maxChunks}
                  display={String(tuning.maxChunks)}
                  min={1}
                  max={100}
                  step={1}
                  onChange={(maxChunks) =>
                    onTuningChange({ ...tuning, maxChunks })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Chunks are collapsed to one row per item, keeping each
                  item&apos;s best-scoring chunk.
                </p>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
};
