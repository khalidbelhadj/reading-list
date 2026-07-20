import { IconChevronRight } from "@tabler/icons-react";
import React from "react";

import { NonIdealState } from "@/components/ui/non-ideal-state";
import { SquareSpinner } from "@/components/ui/square-spinner";
import { type Item } from "@/lib/types";
import { useElementSize } from "@/lib/use-element-size";
import { cn } from "@/lib/utils";

import { CollapsibleSection } from "./collapsible-section";
import { ItemList } from "./item-list";
import { type AskStep } from "./use-ask";

type AskResultsProps = {
  summary: string | null;
  steps: AskStep[];
  resultIds: string[] | null;
  isAsking: boolean;
  hasPresented: boolean;
  error: Error | null;
  items: Item[];
};

type ToolStep = Extract<AskStep, { kind: "tool" }>;

// Shapes the tools return (see app/api/ask/server.ts). Output is `unknown` on
// the part, so we narrow defensively when rendering.
type SearchItemOutput = { id: string };
type FlashcardOutput = {
  itemId: string | null;
  front: string;
  itemTitle: string | null;
};

const outputCount = (step: ToolStep): number | null =>
  Array.isArray(step.output) ? step.output.length : null;

// The collapsible header text — "Searched items, N results". The call's params
// are listed as key/values above the results when expanded.
const describeTool = (step: ToolStep): string => {
  const verb =
    step.name === "search_flashcards"
      ? "Searched flashcards"
      : "Searched items";
  const count = outputCount(step);
  if (count !== null) {
    return `${verb}, ${count} result${count === 1 ? "" : "s"}`;
  }
  return verb;
};

// The tool call's input params as [key, value] pairs, for the key/value list
// shown above the results. Skips undefined/empty values.
const paramEntries = (step: ToolStep): [string, string][] => {
  const input = step.input;
  if (input === null || typeof input !== "object") return [];
  return Object.entries(input as Record<string, unknown>)
    .filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    )
    .map(([key, value]) => [key, String(value)]);
};

// A single tool call: a collapsible row whose body shows the tool's results in a
// bordered box. search_items → item rows; search_flashcards → card list. Rows
// pull their actions/state from the surrounding ItemRowProvider context.
const ToolStepRow = ({
  step,
  itemsById,
}: {
  step: ToolStep;
  itemsById: Map<string, Item>;
}) => {
  const [open, setOpen] = React.useState(false);

  const body = React.useMemo(() => {
    if (!Array.isArray(step.output)) {
      return <p className="p-2 text-xs text-muted-foreground">Running…</p>;
    }

    if (step.name === "search_flashcards") {
      const cards = step.output as FlashcardOutput[];
      if (cards.length === 0) {
        return <p className="p-2 text-xs text-muted-foreground">No matches.</p>;
      }
      return (
        <div className="flex flex-col gap-1.5 p-2">
          {cards.map((card, index) => (
            <div key={index} className="flex flex-col">
              <span className="truncate text-xs text-foreground">
                {card.front}
              </span>
              {card.itemTitle && (
                <span className="truncate text-[11px] text-muted-foreground">
                  {card.itemTitle}
                </span>
              )}
            </div>
          ))}
        </div>
      );
    }

    // search_items (default): resolve the returned ids against the cache and
    // render them as rows. Skip any we don't have locally.
    const rows = step.output as SearchItemOutput[];
    const resolved: Item[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      if (!row?.id || seen.has(row.id)) continue;
      const item = itemsById.get(row.id);
      if (item) {
        resolved.push(item);
        seen.add(row.id);
      }
    }
    if (resolved.length === 0) {
      return <p className="p-2 text-xs text-muted-foreground">No matches.</p>;
    }
    return (
      <div className="p-1">
        <ItemList items={resolved} keyPrefix={`tool-${step.toolCallId}`} />
      </div>
    );
  }, [step, itemsById]);

  const params = paramEntries(step);

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors outline-none select-none hover:text-foreground"
      >
        <IconChevronRight
          className={cn(
            "size-3.5 shrink-0 transition-transform duration-150",
            open && "rotate-90",
          )}
        />
        <span className="min-w-0 truncate">{describeTool(step)}</span>
      </button>
      <CollapsibleSection open={open}>
        {/* The call's params as a plain key/value list above the results. */}
        {params.length > 0 && (
          <div className="mt-1 flex flex-col gap-0.5 px-0.5 font-mono text-[11px] text-muted-foreground">
            {params.map(([key, value]) => (
              <div key={key} className="flex min-w-0 gap-1.5">
                <span className="shrink-0">{key}:</span>
                <span className="min-w-0 truncate text-foreground">
                  {value}
                </span>
              </div>
            ))}
          </div>
        )}
        {/* Cap the result window at ~5 rows (≈30px each); the rest scrolls. */}
        <div className="mt-1 max-h-[9.5rem] overflow-auto rounded-lg border border-border">
          {body}
        </div>
      </CollapsibleSection>
    </div>
  );
};

export const AskResults = ({
  summary,
  steps,
  resultIds,
  isAsking,
  hasPresented,
  error,
  items,
}: AskResultsProps) => {
  const itemsById = React.useMemo(() => {
    const map = new Map<string, Item>();
    for (const item of items) map.set(item.id, item);
    return map;
  }, [items]);

  // Resolve the agent's chosen ids against the in-memory cache, preserving its
  // ordering and dropping any ids we don't have locally.
  const resultItems = React.useMemo(() => {
    if (!resultIds) return [];
    const seen = new Set<string>();
    const resolved: Item[] = [];
    for (const id of resultIds) {
      if (seen.has(id)) continue;
      const item = itemsById.get(id);
      if (item) {
        resolved.push(item);
        seen.add(id);
      }
    }
    return resolved;
  }, [resultIds, itemsById]);

  const showEmpty = hasPresented && !isAsking && resultItems.length === 0;

  // Drive the streaming gradient boundary (--ask-mask-stop) to the live content
  // height. CSS eases it there, so the soft edge glides down as text streams and
  // settles below the last line when it stops — never parking over content.
  const streamRef = React.useRef<HTMLDivElement | null>(null);
  useElementSize(
    streamRef,
    React.useCallback(() => {
      const el = streamRef.current;
      if (el) el.style.setProperty("--ask-mask-stop", `${el.scrollHeight}px`);
    }, []),
    // immediate: the mask boundary must be positioned before the observer's
    // first async delivery, matching the old effect's up-front update() call.
    { mode: "sync", enabled: isAsking, immediate: true },
  );

  // A failed request replaces the whole feed with the shared centered non-ideal
  // state (title + faint description), matching the empty state.
  if (error) {
    return (
      <NonIdealState
        tone="error"
        align="center"
        size="sm"
        className="py-6"
        title="Something went wrong"
        description={error.message || "The search couldn't be completed."}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Append-only activity feed: the agent's narration and tool calls stream
          in, in order, followed by the summary line and then the results. */}
      <div className="px-1">
        {/* While streaming, a soft gradient boundary masks the bottom edge so the
            newest content emerges through it instead of popping. The boundary
            descends as the feed grows; the spinner below marks it. */}
        <div
          ref={streamRef}
          className={cn(
            "flex min-w-0 flex-1 flex-col gap-1.5",
            isAsking && "ask-stream-mask",
          )}
        >
          {steps.map((step, index) =>
            step.kind === "text" ? (
              <p
                key={`text-${index}`}
                className="text-sm whitespace-pre-wrap text-foreground"
              >
                {step.text}
              </p>
            ) : (
              <ToolStepRow
                key={step.toolCallId}
                step={step}
                itemsById={itemsById}
              />
            ),
          )}

          {/* The final summary line, once the agent presents its results. */}
          {summary !== null && (
            <p className="text-sm whitespace-pre-wrap text-foreground">
              {summary}
            </p>
          )}
        </div>

        {/* Loading indicator sits just below the gradient boundary, crisp. */}
        {isAsking && <SquareSpinner className="mt-2" />}
      </div>

      {showEmpty && (
        <div className="reveal-down px-1 py-4 text-center text-xs text-muted-foreground">
          No matching items.
        </div>
      )}

      {resultItems.length > 0 && (
        <div className="reveal-down">
          <ItemList items={resultItems} keyPrefix="ask" />
        </div>
      )}
    </div>
  );
};
