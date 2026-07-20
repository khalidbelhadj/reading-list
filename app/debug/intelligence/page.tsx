// Dev window into the intelligence layer: one row per item_content record,
// faceted filters on the left, and the pipeline controls (backfill / drain /
// heal / re-extract / re-embed) under them. Deliberately just a table — the
// value here is seeing the raw job state, not a dashboard.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type Column,
  type ColumnPinningState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  type Row,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import React from "react";

import {
  backfillMyContent,
  getIntelligenceOverview,
  processQueueBatch,
  reembedItem,
  reextractItem,
  retryMissingEmbeddings,
  semanticSearch,
} from "@/app/actions";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

import {
  intelligenceColumns,
  type IntelligenceRow,
  SEARCH_COLUMNS,
} from "./columns";
import { FilterSidebar } from "./filter-sidebar";
import { HeaderCell } from "./header-cell";
import { DEFAULT_TUNING, SearchBar, type SearchTuning } from "./search-bar";

const COLUMN_IDS = intelligenceColumns.map(
  (column) => column.id ?? ("accessorKey" in column ? column.accessorKey : ""),
) as string[];

// Column id → the title shown in its header, for the sidebar's column search.
const COLUMN_TITLES = new Map(
  intelligenceColumns.map((column, index) => [
    COLUMN_IDS[index] ?? "",
    typeof column.header === "string" ? column.header : "",
  ]),
);

// Every cell width and pinned offset is read from a CSS variable set on the
// <table>. That indirection is what makes resizing cheap: during a drag only
// the table element's style object changes, so the 250 rows underneath never
// re-render (see MemoTableBody). Pinned offsets are accumulated widths, so
// they have to be variables too or pinned columns would drift mid-drag.
const cellStyle = (
  column: Column<IntelligenceRow, unknown>,
): React.CSSProperties => {
  const pinned = column.getIsPinned();
  const width = `var(--col-${column.id}-size)`;
  if (!pinned) return { width };
  return {
    width,
    position: "sticky",
    zIndex: 1,
    ...(pinned === "left"
      ? { left: `var(--col-${column.id}-start)` }
      : { right: `var(--col-${column.id}-after)` }),
  };
};

const TableBody = ({
  rows,
}: {
  rows: Row<IntelligenceRow>[];
  // Read only by the memo comparator below, not during render.
  isResizing: boolean;
}) => (
  <tbody>
    {rows.map((row) => (
      <tr
        key={row.id}
        data-selected={row.getIsSelected() ? "" : undefined}
        // An explicit background (not transparent) so sticky pinned cells
        // inherit it and rows can't show through.
        className="border-b border-border/50 bg-background hover:bg-muted/30 data-selected:bg-muted/50"
      >
        {row.getVisibleCells().map((cell) => (
          <td
            key={cell.id}
            style={cellStyle(cell.column)}
            className={cn(
              "px-2 py-1.5 align-middle",
              cell.column.getIsPinned() && "bg-inherit",
            )}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        ))}
      </tr>
    ))}
  </tbody>
);

// Frozen for the duration of a resize drag: widths are CSS variables on the
// <table>, so the rows do not need to re-render to follow the handle, and
// re-rendering 250 of them per pointermove is exactly what makes naive column
// resizing feel awful. Every other update re-renders normally.
const MemoTableBody = React.memo(
  TableBody,
  (prev, next) => prev.isResizing && next.isResizing,
);

const DebugIntelligencePage = () => {
  const queryClient = useQueryClient();
  const { data: overview, isLoading } = useQuery({
    queryKey: ["intelligence"],
    queryFn: getIntelligenceOverview,
    // Keep polling only while the queue still has work in flight.
    refetchInterval: (query) =>
      query.state.data?.rows.some((row) => row.status === "pending")
        ? 3000
        : false,
  });

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnOrder, setColumnOrder] = React.useState<string[]>(COLUMN_IDS);
  const [columnPinning, setColumnPinning] = React.useState<ColumnPinningState>({
    left: ["select"],
    right: [],
  });

  const [searchQuery, setSearchQuery] = React.useState("");
  const [tuning, setTuning] = React.useState<SearchTuning>(DEFAULT_TUNING);

  const { data: hits, isFetching: searching } = useQuery({
    queryKey: ["semantic-search", searchQuery, tuning.maxChunks],
    queryFn: () => semanticSearch(searchQuery, tuning.maxChunks),
    enabled: searchQuery.length > 0,
  });

  // Chunk hits collapse to one entry per item, keeping the best-scoring chunk.
  // Applying the threshold here rather than in SQL means moving the slider
  // re-filters instantly instead of spending another embedding call.
  const matches = React.useMemo(() => {
    const best = new Map<string, { similarity: number; snippet: string }>();
    for (const hit of hits ?? []) {
      if (hit.similarity < tuning.minSimilarity) continue;
      const current = best.get(hit.itemId);
      if (!current || hit.similarity > current.similarity) {
        best.set(hit.itemId, {
          similarity: hit.similarity,
          snippet: hit.snippet,
        });
      }
    }
    return best;
  }, [hits, tuning.minSimilarity]);

  // Searching columns hides the ones that don't match, rather than scrolling
  // to them — with 16 columns, narrowing to "error" or "embed" is the fast
  // way to see just that slice. The checkbox column never hides.
  const [columnQuery, setColumnQuery] = React.useState("");
  const isSearching = searchQuery.length > 0;
  const columnVisibility = React.useMemo(() => {
    const visibility: Record<string, boolean> = {};
    // The score columns are meaningless without a search behind them.
    if (!isSearching) {
      for (const columnId of SEARCH_COLUMNS) visibility[columnId] = false;
    }
    const query = columnQuery.trim().toLowerCase();
    if (!query) return visibility;
    for (const [columnId, title] of COLUMN_TITLES) {
      if (columnId === "select") continue;
      if (visibility[columnId] === false) continue;
      visibility[columnId] =
        title.toLowerCase().includes(query) ||
        columnId.toLowerCase().includes(query);
    }
    return visibility;
  }, [columnQuery, isSearching]);

  // A search narrows the table to matching items, ranked by score; without
  // one every row is present with null scores.
  const rows = React.useMemo<IntelligenceRow[]>(() => {
    const all = overview?.rows ?? [];
    if (!isSearching) {
      return all.map((row) => ({ ...row, similarity: null, snippet: null }));
    }
    return all
      .flatMap((row) => {
        const match = matches.get(row.itemId);
        return match ? [{ ...row, ...match }] : [];
      })
      .sort((a, b) => b.similarity - a.similarity);
  }, [overview, isSearching, matches]);

  const table = useReactTable({
    data: rows,
    columns: intelligenceColumns,
    state: {
      sorting,
      rowSelection,
      columnOrder,
      columnPinning,
      columnVisibility,
    },
    getRowId: (row) => row.itemId,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnOrderChange: setColumnOrder,
    onColumnPinningChange: setColumnPinning,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    defaultColumn: { minSize: 60, maxSize: 900 },
  });

  // Drop `source` immediately before `target`, or at the end when dragged onto
  // the last column.
  const handleReorder = React.useCallback(
    (sourceId: string, targetId: string) => {
      setColumnOrder((current) => {
        const next = current.filter((id) => id !== sourceId);
        const targetIndex = next.indexOf(targetId);
        if (targetIndex === -1) return current;
        next.splice(targetIndex, 0, sourceId);
        return next;
      });
    },
    [],
  );

  // getRowId is the item id, so selection keys are item ids directly.
  const selectedIds = React.useMemo(
    () =>
      Object.entries(rowSelection)
        .filter(([, isSelected]) => isSelected)
        .map(([itemId]) => itemId),
    [rowSelection],
  );

  const invalidate = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["intelligence"] });
  }, [queryClient]);

  const backfill = useMutation({
    mutationFn: backfillMyContent,
    onSuccess: invalidate,
  });
  const drain = useMutation({
    mutationFn: processQueueBatch,
    onSuccess: invalidate,
  });
  const heal = useMutation({
    mutationFn: retryMissingEmbeddings,
    onSuccess: invalidate,
  });
  // Bulk actions fan out over the selection one item at a time — these are
  // per-item server actions and this is a dev page, so sequential is fine and
  // keeps the failure mode obvious.
  const reextract = useMutation({
    mutationFn: async (itemIds: string[]) => {
      for (const itemId of itemIds) await reextractItem(itemId);
    },
    onSuccess: invalidate,
  });
  const reembed = useMutation({
    mutationFn: async (itemIds: string[]) => {
      for (const itemId of itemIds) await reembedItem(itemId);
    },
    onSuccess: invalidate,
  });

  const actions = [
    {
      label: reextract.isPending ? "Re-extracting…" : "Re-extract selected",
      pending: reextract.isPending,
      bulk: true,
      run: () => reextract.mutate(selectedIds),
    },
    {
      label: reembed.isPending ? "Re-embedding…" : "Re-embed selected",
      pending: reembed.isPending,
      bulk: true,
      run: () => reembed.mutate(selectedIds),
    },
    {
      label: backfill.isPending ? "Backfilling…" : "Backfill all items",
      pending: backfill.isPending,
      bulk: false,
      run: () => backfill.mutate(),
    },
    {
      label: drain.isPending ? "Draining…" : "Drain queue",
      pending: drain.isPending,
      bulk: false,
      run: () => drain.mutate(),
    },
    {
      label: heal.isPending ? "Healing…" : "Heal missing embeddings",
      pending: heal.isPending,
      bulk: false,
      run: () => heal.mutate(),
    },
  ];

  const visibleRows = table.getRowModel().rows;

  const isResizing =
    table.getState().columnSizingInfo.isResizingColumn !== false;

  // Rebuilt every render — it is one pass over ~18 headers, far cheaper than
  // the bookkeeping a memo would need to stay correct across sizing, pinning,
  // ordering and visibility changes.
  const columnSizeVars: Record<string, string> = {};
  for (const header of table.getFlatHeaders()) {
    const { column } = header;
    columnSizeVars[`--col-${column.id}-size`] = `${header.getSize()}px`;
    if (column.getIsPinned() === "left") {
      columnSizeVars[`--col-${column.id}-start`] =
        `${column.getStart("left")}px`;
    } else if (column.getIsPinned() === "right") {
      columnSizeVars[`--col-${column.id}-after`] =
        `${column.getAfter("right")}px`;
    }
  }

  // Live queue depth, straight off the same rows the table renders.
  const queueCounts = React.useMemo(() => {
    let running = 0;
    let queued = 0;
    let retryWait = 0;
    let stuck = 0;
    for (const row of rows) {
      if (row.queueState === "running") running++;
      else if (row.queueState === "queued") queued++;
      else if (row.queueState === "retry-wait") retryWait++;
      else if (row.queueState === "stuck") stuck++;
    }
    return { running, queued, retryWait, stuck };
  }, [rows]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {/* This page owns the window's top-left corner, so the header reserves
          the macOS traffic-light clearance (no-op on web) and doubles as the
          window drag region. */}
      <header className="electron-top-bar-inset panel-toolbar flex shrink-0 items-baseline gap-3 border-b border-border px-4 py-3">
        <h1 className="font-content text-base">Intelligence</h1>
        <p className="text-xs text-muted-foreground">
          {visibleRows.length} of {rows.length} content rows ·{" "}
          {overview?.totalItems ?? "…"} items total
        </p>
        <p className="font-mono text-xs text-muted-foreground">
          queue: {queueCounts.running} running · {queueCounts.queued} queued ·{" "}
          {queueCounts.retryWait} waiting
          {queueCounts.stuck > 0 && (
            <span className="text-destructive">
              {" "}
              · {queueCounts.stuck} stuck
            </span>
          )}
        </p>
        <SearchBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          tuning={tuning}
          onTuningChange={setTuning}
          searching={searching}
          resultSummary={
            isSearching && !searching
              ? `${matches.size} items / ${hits?.length ?? 0} chunks`
              : null
          }
        />
        {backfill.data && (
          <span className="text-xs text-muted-foreground">
            enqueued {backfill.data.enqueued}
          </span>
        )}
        {drain.data && (
          <span className="text-xs text-muted-foreground">
            processed {drain.data.processed} (ok {drain.data.ok}, failed{" "}
            {drain.data.failed})
          </span>
        )}
        {heal.data && (
          <span className="text-xs text-muted-foreground">
            healed {heal.data.healed}
          </span>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        <FilterSidebar
          table={table}
          selectedIds={selectedIds}
          actions={actions}
          columnQuery={columnQuery}
          onColumnQueryChange={setColumnQuery}
        />

        <div className="min-w-0 flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-4">
              <Spinner />
            </div>
          ) : rows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No content rows yet — hit “Backfill all items”.
            </p>
          ) : (
            <table
              className="border-collapse text-sm"
              // The per-column size/offset variables every cell reads. Updating
              // them here is the whole resize animation — the rows below are
              // memoized and never re-render while a drag is in flight.
              style={{
                ...columnSizeVars,
                width: table.getTotalSize(),
                tableLayout: "fixed",
              }}
            >
              <thead className="sticky top-0 z-20">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <HeaderCell
                        key={header.id}
                        header={header}
                        onReorder={handleReorder}
                        style={cellStyle(header.column)}
                      />
                    ))}
                  </tr>
                ))}
              </thead>
              <MemoTableBody rows={visibleRows} isResizing={isResizing} />
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default DebugIntelligencePage;
