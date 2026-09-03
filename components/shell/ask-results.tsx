import { IconChevronRight } from "@tabler/icons-react";
import React from "react";

import { Button } from "@/components/system/button";
import { EmptyState } from "@/components/system/empty-state";
import { SquareSpinner } from "@/components/system/square-spinner";
import { type Item } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ItemRow } from "./item-row";
import { type AskStep } from "./use-ask";

type ToolStep = Extract<AskStep, { kind: "tool" }>;

// Shapes the tools return (see app/api/ask/tools.ts). Output is `unknown` on
// the part, so we narrow defensively when rendering.
type SearchItemOutput = { id: string };
type FlashcardOutput = {
  itemId: string | null;
  front: string;
  itemTitle: string | null;
};
type ReadItemOutput = { title?: string; cards?: unknown[]; error?: string };

const isCardRows = (rows: unknown[]): rows is FlashcardOutput[] =>
  rows.length > 0 &&
  typeof rows[0] === "object" &&
  rows[0] !== null &&
  "front" in rows[0];

// The step header text — "Searched items, N results".
const describeTool = (step: ToolStep): string => {
  if (step.name === "read_item") {
    const output = step.output as ReadItemOutput | undefined;
    return output?.title ? `Read ${output.title}` : "Read item";
  }
  const scope =
    step.input && typeof step.input === "object" && "scope" in step.input
      ? (step.input as { scope?: string }).scope
      : undefined;
  const verb =
    step.name === "search_flashcards"
      ? "Searched flashcards"
      : step.name === "semantic_search"
        ? scope === "cards"
          ? "Searched flashcards by meaning"
          : "Searched by meaning"
        : "Searched items";
  if (!Array.isArray(step.output)) return verb;
  const count = step.output.length;
  return `${verb}, ${count} result${count === 1 ? "" : "s"}`;
};

// The tool call's input params as [key, value] pairs, for the key/value list
// shown above the results. Skips empty values.
const paramEntries = (step: ToolStep): [string, string][] => {
  if (step.input === null || typeof step.input !== "object") return [];
  return Object.entries(step.input as Record<string, unknown>)
    .filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    )
    .map(([key, value]) => [key, String(value)]);
};

// A single tool call: a toggleable row whose body shows the call's params and
// its results in a quiet-fill box. search_items → item rows resolved against
// the cache; search_flashcards → card fronts with their item titles.
const ToolStepRow = ({
  step,
  itemsById,
  onOpen,
}: {
  step: ToolStep;
  itemsById: Map<string, Item>;
  onOpen: (id: string) => void;
}) => {
  const [open, setOpen] = React.useState(false);

  const body = React.useMemo(() => {
    if (step.name === "read_item") {
      const output = step.output as ReadItemOutput | undefined;
      const cardCount = Array.isArray(output?.cards) ? output.cards.length : 0;
      return (
        <p className="p-2 text-small text-muted-foreground">
          {output?.error ??
            (output
              ? `${cardCount} card${cardCount === 1 ? "" : "s"}`
              : "Reading…")}
        </p>
      );
    }
    if (!Array.isArray(step.output)) {
      return <p className="p-2 text-small text-muted-foreground">Running…</p>;
    }

    if (step.name === "search_flashcards" || isCardRows(step.output)) {
      const cards = step.output as FlashcardOutput[];
      if (cards.length === 0) {
        return (
          <p className="p-2 text-small text-muted-foreground">No matches.</p>
        );
      }
      return (
        <div className="flex flex-col gap-1.5 p-2">
          {cards.map((card, index) => (
            <div key={index} className="flex flex-col">
              <span className="truncate text-small text-foreground">
                {card.front}
              </span>
              {card.itemTitle && (
                <span className="truncate text-micro text-muted-foreground">
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
      return (
        <p className="p-2 text-small text-muted-foreground">No matches.</p>
      );
    }
    return (
      <ul className="flex flex-col gap-0.5 p-1">
        {resolved.map((item) => (
          <li key={item.id}>
            <ItemRow item={item} onOpen={onOpen} />
          </li>
        ))}
      </ul>
    );
  }, [step, itemsById, onOpen]);

  return (
    <div className="flex flex-col items-start">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-1 px-1"
        onClick={() => setOpen((prev) => !prev)}
      >
        <IconChevronRight
          className={cn(
            "transition-transform duration-150",
            open && "rotate-90",
          )}
        />
        {describeTool(step)}
      </Button>
      {open && (
        <div className="flex w-full flex-col">
          {paramEntries(step).length > 0 && (
            <div className="mt-1 flex flex-col gap-0.5 px-1 font-mono text-micro text-muted-foreground">
              {paramEntries(step).map(([key, value]) => (
                <div key={key} className="flex min-w-0 gap-1.5">
                  <span className="shrink-0">{key}:</span>
                  <span className="min-w-0 truncate text-foreground">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          )}
          {/* Cap the result window at ~5 rows; the rest scrolls. */}
          <div className="mt-1 max-h-40 overflow-auto rounded-control bg-foreground/[0.03]">
            {body}
          </div>
        </div>
      )}
    </div>
  );
};

// The Ask activity feed: the agent's narration and tool calls stream in, in
// order, followed by the summary line, an optional action (start the review,
// review these), and then the chosen items as rows.
export const AskResults = ({
  steps,
  summary,
  resultIds,
  isAsking,
  hasPresented,
  error,
  items,
  onOpen,
  action,
}: {
  steps: AskStep[];
  summary: string | null;
  resultIds: string[] | null;
  isAsking: boolean;
  hasPresented: boolean;
  error: Error | null;
  items: Item[];
  onOpen: (id: string) => void;
  action?: React.ReactNode;
}) => {
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

  if (error) {
    return (
      <EmptyState
        tone="error"
        className="py-6"
        title="Something went wrong"
        description={error.message || "The search couldn't be completed."}
      />
    );
  }

  const showEmpty = hasPresented && !isAsking && resultItems.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-w-0 flex-col gap-1.5 px-1">
        {steps.map((step, index) =>
          step.kind === "text" ? (
            <p
              key={`text-${index}`}
              className="text-body whitespace-pre-wrap text-foreground"
            >
              {step.text}
            </p>
          ) : (
            <ToolStepRow
              key={step.toolCallId}
              step={step}
              itemsById={itemsById}
              onOpen={onOpen}
            />
          ),
        )}

        {summary !== null && (
          <p className="text-body whitespace-pre-wrap text-foreground">
            {summary}
          </p>
        )}

        {isAsking && <SquareSpinner className="mt-1" />}
        {!isAsking && action}
      </div>

      {showEmpty && (
        <p className="py-4 text-center text-small text-muted-foreground">
          No matching items.
        </p>
      )}

      {resultItems.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {resultItems.map((item) => (
            <li key={item.id}>
              <ItemRow item={item} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
