// Left rail of the intelligence page: one faceted filter group per
// low-cardinality column, then the actions that operate on the current
// selection pinned to the bottom. Resizable and collapsible; both are local
// UI state since nothing outside this rail depends on them.
//
// Counts come from the table's faceted row model, so each group shows how many
// rows a value *would* match given the other groups' filters — the usual
// faceted-search behaviour, and the reason this reads off the table instead of
// off the raw array.
import { IconChevronsLeft, IconChevronsRight } from "@tabler/icons-react";
import { type Table } from "@tanstack/react-table";
import React from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { usePanelResize } from "@/lib/use-panel-resize";
import { cn } from "@/lib/utils";

import { FACET_COLUMNS, FACET_LABELS, type IntelligenceRow } from "./columns";

const MIN_WIDTH = 180;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 256;

const clampWidth = (width: number) =>
  Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));

const FacetGroup = ({
  table,
  columnId,
}: {
  table: Table<IntelligenceRow>;
  columnId: string;
}) => {
  const column = table.getColumn(columnId);
  const facets = column?.getFacetedUniqueValues();

  const values = React.useMemo(() => {
    if (!facets) return [];
    return [...facets.entries()]
      .filter(([value]) => value != null)
      .map(([value, count]) => ({ value: String(value), count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  }, [facets]);

  if (!column || values.length === 0) return null;

  const selected = new Set((column.getFilterValue() as string[]) ?? []);
  const max = Math.max(...values.map((entry) => entry.count));

  const toggle = (value: string) => {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    column.setFilterValue(next.size ? [...next] : undefined);
  };

  return (
    <div className="flex flex-col gap-1">
      <p className="px-1 text-xs font-medium text-muted-foreground">
        {FACET_LABELS[columnId as (typeof FACET_COLUMNS)[number]] ?? columnId}
      </p>
      {values.map(({ value, count }) => (
        // Checkbox renders a <button role="checkbox">, which a native <label>
        // does not forward clicks to — so the row itself has to handle the
        // click, or only the 16px box would be hittable despite the whole row
        // lighting up on hover.
        <div
          key={value}
          role="presentation"
          onClick={() => toggle(value)}
          className="flex cursor-default items-center gap-2 rounded-md px-1 py-1 hover:bg-muted"
        >
          <Checkbox
            checked={selected.has(value)}
            // The row's handler already toggles; without this the click on the
            // box itself would bubble up and toggle a second time.
            onCheckedChange={() => {}}
          />
          <span className="min-w-0 flex-1 truncate text-sm">{value}</span>
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {count}
          </span>
          <span className="h-1.5 w-12 shrink-0 overflow-hidden rounded-xs bg-muted">
            <span
              className="block h-full rounded-xs bg-primary"
              style={{ width: `${(count / max) * 100}%` }}
            />
          </span>
        </div>
      ))}
    </div>
  );
};

// One button in the actions rail. `bulk` actions are disabled with no
// selection; the rest always apply to the whole list.
export type PipelineAction = {
  label: string;
  pending: boolean;
  bulk: boolean;
  run: () => void;
};

export const FilterSidebar = ({
  table,
  selectedIds,
  actions,
  columnQuery,
  onColumnQueryChange,
}: {
  table: Table<IntelligenceRow>;
  selectedIds: string[];
  // Rendered in order, below the facets.
  actions: PipelineAction[];
  // Hides non-matching columns from the table. Lives in the page because the
  // table's columnVisibility is derived from it.
  columnQuery: string;
  onColumnQueryChange: (query: string) => void;
}) => {
  const [collapsed, setCollapsed] = React.useState(false);
  const [width, setWidth] = React.useState(DEFAULT_WIDTH);
  const asideRef = React.useRef<HTMLElement>(null);

  const activeFilters = table.getState().columnFilters.length;

  // The rail is flush against the left edge, so the pointer's x IS the width.
  // Written straight to the element during the drag (no re-render per event),
  // committed to state on release — the same pattern the app's panels use.
  const applyWidth = React.useCallback((clientX: number) => {
    const next = clampWidth(clientX);
    if (asideRef.current) asideRef.current.style.width = `${next}px`;
    return next;
  }, []);
  const { dragging, startResize } = usePanelResize({
    onDrag: applyWidth,
    onEnd: (clientX) => setWidth(applyWidth(clientX)),
  });

  if (collapsed) {
    return (
      <div className="flex w-11 shrink-0 flex-col items-center gap-2 border-r border-border py-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCollapsed(false)}
          aria-label="Show filters"
        >
          <IconChevronsRight />
        </Button>
        {activeFilters > 0 && (
          <span className="font-mono text-xs text-muted-foreground">
            {activeFilters}
          </span>
        )}
      </div>
    );
  }

  return (
    <aside
      ref={asideRef}
      className="relative flex shrink-0 flex-col border-r border-border"
      style={{ width }}
    >
      <div className="flex items-center gap-1 px-3 py-3">
        <p className="flex-1 font-content text-sm">
          Filters{activeFilters > 0 ? ` (${activeFilters})` : ""}
        </p>
        {activeFilters > 0 && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => table.resetColumnFilters()}
          >
            Clear
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCollapsed(true)}
          aria-label="Hide filters"
        >
          <IconChevronsLeft />
        </Button>
      </div>

      <div className="px-2 pb-2">
        <Input
          value={columnQuery}
          onChange={(event) => onColumnQueryChange(event.target.value)}
          placeholder="Search columns…"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2 pb-4">
        {FACET_COLUMNS.map((columnId) => (
          <FacetGroup key={columnId} table={table} columnId={columnId} />
        ))}
      </div>

      {/* pb-7 clears the dev banner, which is fixed to the bottom of the
          viewport. It only renders in development — but so does this page. */}
      <div className="flex flex-col gap-1 border-t border-border p-2 pb-7">
        <p className="px-1 pb-1 text-xs text-muted-foreground">
          {selectedIds.length > 0
            ? `${selectedIds.length} selected`
            : "No selection"}
        </p>
        {actions.map((action) => (
          <Button
            key={action.label}
            variant="outline"
            size="sm"
            className="justify-start"
            disabled={
              action.pending || (action.bulk && selectedIds.length === 0)
            }
            onClick={action.run}
          >
            {action.label}
          </Button>
        ))}
      </div>

      {/* Resize strip straddling the right border — the boundary is the grab
          area, same as the app's other panels. */}
      <div
        role="separator"
        aria-orientation="vertical"
        onPointerDown={startResize}
        onDoubleClick={() => {
          setWidth(DEFAULT_WIDTH);
          if (asideRef.current) {
            asideRef.current.style.width = `${DEFAULT_WIDTH}px`;
          }
        }}
        className="group/resize absolute inset-y-0 -right-2 z-10 w-4 cursor-col-resize"
      >
        <div
          className={cn(
            "absolute inset-y-0 left-1/2 w-0.75 -translate-x-1/2 rounded-full transition-[opacity,background-color] duration-150",
            dragging
              ? "bg-foreground/70 opacity-100"
              : "bg-muted-foreground/50 opacity-0 group-hover/resize:opacity-100",
          )}
        />
      </div>
    </aside>
  );
};
