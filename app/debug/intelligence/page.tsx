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
  getEmbeddingSettings,
  getIntelligenceOverview,
  processQueueBatch,
  reembedItem,
  reextractItem,
  retryMissingEmbeddings,
  semanticSearch,
  updateEmbeddingSettings,
} from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

import {
  intelligenceColumns,
  type IntelligenceRow,
  SEARCH_COLUMNS,
} from "./columns";
import { DetailPane } from "./detail-pane";
import { FilterSidebar, type PipelineAction } from "./filter-sidebar";
import { HeaderCell } from "./header-cell";
import { ModelPicker } from "./model-picker";
import { DEFAULT_TUNING, SearchBar, type SearchTuning } from "./search-bar";
import { Stat } from "./stat";

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
  detailItemId,
  onOpenDetail,
}: {
  rows: Row<IntelligenceRow>[];
  detailItemId: string | null;
  onOpenDetail: (itemId: string) => void;
  // Read only by the memo comparator below, not during render.
  isResizing: boolean;
}) => (
  <tbody>
    {rows.map((row) => (
      <tr
        key={row.id}
        data-selected={row.getIsSelected() ? "" : undefined}
        data-open={row.original.itemId === detailItemId ? "" : undefined}
        // The row opens the detail pane, but the checkbox cell must not — it
        // has its own meaning (bulk selection), so it stops the click below.
        onClick={() => onOpenDetail(row.original.itemId)}
        // An explicit background (not transparent) so sticky pinned cells
        // inherit it and rows can't show through.
        className="cursor-default border-b border-border/50 bg-background hover:bg-muted/30 data-open:bg-muted/60 data-selected:bg-muted/50"
      >
        {row.getVisibleCells().map((cell) => (
          <td
            key={cell.id}
            style={cellStyle(cell.column)}
            onClick={
              cell.column.id === "select"
                ? (event) => event.stopPropagation()
                : undefined
            }
            className={cn(
              "border-r border-border/60 px-2 py-1.5 align-middle",
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
    // Keep polling only while the queue has work that can still change state.
    // A `stuck` row is pending but terminal (out of attempts), so it is
    // excluded — otherwise the page would poll forever with nothing to observe.
    refetchInterval: (query) =>
      query.state.data?.rows.some(
        (row) =>
          row.queueState === "queued" ||
          row.queueState === "running" ||
          row.queueState === "retry-wait",
      )
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
  // Hides non-matching columns from the table — see columnVisibility below.
  const [columnQuery, setColumnQuery] = React.useState("");
  // The row open in the detail pane. Held as an id, not a row object, so the
  // pane follows the 3s poll instead of freezing the state it opened with.
  const [detailItemId, setDetailItemId] = React.useState<string | null>(null);
  // Pane width lives here, not in the pane, so it survives the pane's
  // per-item remount — resizing then clicking a different row keeps the size.
  const [detailWidth, setDetailWidth] = React.useState(480);
  // Clicking the row that's already open closes the pane (toggle).
  const handleOpenDetail = React.useCallback(
    (itemId: string) =>
      setDetailItemId((current) => (current === itemId ? null : itemId)),
    [],
  );

  const { data: embeddingConfig } = useQuery({
    queryKey: ["embedding-settings"],
    queryFn: getEmbeddingSettings,
  });

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
  const isSearching = searchQuery.length > 0;
  const { columnVisibility, noColumnMatch } = React.useMemo(() => {
    const visibility: Record<string, boolean> = {};
    // The score columns are meaningless without a search behind them.
    if (!isSearching) {
      for (const columnId of SEARCH_COLUMNS) visibility[columnId] = false;
    }
    const query = columnQuery.trim().toLowerCase();
    if (!query) return { columnVisibility: visibility, noColumnMatch: false };

    const narrowed = { ...visibility };
    let anyMatch = false;
    for (const [columnId, title] of COLUMN_TITLES) {
      if (columnId === "select") continue;
      if (narrowed[columnId] === false) continue;
      const matches =
        title.toLowerCase().includes(query) ||
        columnId.toLowerCase().includes(query);
      narrowed[columnId] = matches;
      if (matches) anyMatch = true;
    }
    // A query matching nothing would hide every column and leave a table of
    // bare checkboxes, which reads as a broken page rather than an empty
    // result. Keep the unnarrowed set and say so in the header instead.
    return {
      columnVisibility: anyMatch ? narrowed : visibility,
      noColumnMatch: !anyMatch,
    };
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
  // Intersected with the currently visible rows: rowSelection persists across
  // filter/search changes, so without this a "select all → search" sequence
  // would fan a bulk action out over items no longer on screen.
  const selectedIds = React.useMemo(() => {
    const visible = new Set(rows.map((row) => row.itemId));
    return Object.entries(rowSelection)
      .filter(([itemId, isSelected]) => isSelected && visible.has(itemId))
      .map(([itemId]) => itemId);
  }, [rowSelection, rows]);

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

  const runReextract = React.useCallback(
    () => reextract.mutate(selectedIds),
    [reextract, selectedIds],
  );
  const runReembed = React.useCallback(
    () => reembed.mutate(selectedIds),
    [reembed, selectedIds],
  );
  // Switching the model changes what search returns immediately (it filters
  // to the active model) while re-embedding happens in the background, so
  // both the overview and any open search need to re-read.
  const setEmbeddingModel = useMutation({
    mutationFn: updateEmbeddingSettings,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["embedding-settings"] });
      void queryClient.invalidateQueries({ queryKey: ["intelligence"] });
      void queryClient.invalidateQueries({ queryKey: ["semantic-search"] });
    },
  });

  const runBackfill = React.useCallback(() => backfill.mutate(), [backfill]);
  const runDrain = React.useCallback(() => drain.mutate(), [drain]);
  const runHeal = React.useCallback(() => heal.mutate(), [heal]);

  const actions = React.useMemo<PipelineAction[]>(
    () => [
      {
        label: reextract.isPending ? "Re-extracting…" : "Re-extract selected",
        tooltip:
          "Re-fetch and re-parse the page for the selected items, then re-embed them.",
        pending: reextract.isPending,
        bulk: true,
        run: runReextract,
      },
      {
        label: reembed.isPending ? "Re-embedding…" : "Re-embed selected",
        tooltip:
          "Recompute embeddings for the selected items from their already-extracted text.",
        pending: reembed.isPending,
        bulk: true,
        run: runReembed,
      },
      {
        label: backfill.isPending ? "Backfilling…" : "Backfill all items",
        tooltip: "Queue every item that has no content row yet for extraction.",
        pending: backfill.isPending,
        bulk: false,
        run: runBackfill,
      },
      {
        label: drain.isPending ? "Draining…" : "Drain queue",
        tooltip:
          "Process a batch of pending items right now instead of waiting for the background worker.",
        pending: drain.isPending,
        bulk: false,
        run: runDrain,
      },
      {
        label: heal.isPending ? "Healing…" : "Heal missing embeddings",
        tooltip:
          "Find items that extracted fine but never got an embedding, and embed them.",
        pending: heal.isPending,
        bulk: false,
        run: runHeal,
      },
    ],
    [
      reextract.isPending,
      reembed.isPending,
      backfill.isPending,
      drain.isPending,
      heal.isPending,
      runReextract,
      runReembed,
      runBackfill,
      runDrain,
      runHeal,
    ],
  );

  const visibleRows = table.getRowModel().rows;

  // Resolved from the live rows rather than stored, so the open pane tracks
  // the 3s poll. A row that leaves the set (deleted, or filtered out by a
  // search) closes the pane rather than showing a stale document.
  const detailRow = React.useMemo(
    () => rows.find((row) => row.itemId === detailItemId) ?? null,
    [rows, detailItemId],
  );
  const closeDetail = React.useCallback(() => setDetailItemId(null), []);

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

  // Global queue depth — over the full overview, NOT the search-narrowed
  // `rows`, so a search matching a couple of items can't make the whole
  // queue look nearly empty.
  const queueCounts = React.useMemo(() => {
    let running = 0;
    let queued = 0;
    let retryWait = 0;
    let stuck = 0;
    for (const row of overview?.rows ?? []) {
      if (row.queueState === "running") running++;
      else if (row.queueState === "queued") queued++;
      else if (row.queueState === "retry-wait") retryWait++;
      else if (row.queueState === "stuck") stuck++;
    }
    return { running, queued, retryWait, stuck };
  }, [overview]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {/* This page owns the window's top-left corner, so the header reserves
          the macOS traffic-light clearance (no-op on web) and doubles as the
          window drag region. */}
      <header className="electron-top-bar-inset electron-top-bar-text-start panel-toolbar flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
        <h1 className="font-content text-base">Intelligence</h1>
        <span className="flex items-center gap-1.5">
          <Stat label="rows" value={`${visibleRows.length} / ${rows.length}`} />
          <Stat label="items" value={overview?.totalItems ?? "…"} />
          {noColumnMatch && (
            <Badge variant="destructive">no columns match</Badge>
          )}
        </span>
        <span className="flex items-center gap-1.5">
          <Stat label="running" value={queueCounts.running} tone="default" />
          <Stat label="queued" value={queueCounts.queued} />
          <Stat label="waiting" value={queueCounts.retryWait} tone="outline" />
          {queueCounts.stuck > 0 && (
            <Stat label="stuck" value={queueCounts.stuck} tone="destructive" />
          )}
        </span>
        {backfill.data && (
          <Stat label="enqueued" value={backfill.data.enqueued} />
        )}
        {drain.data && (
          <span className="flex items-center gap-1.5">
            <Stat label="processed" value={drain.data.processed} />
            <Stat label="ok" value={drain.data.ok} />
            <Stat
              label="failed"
              value={drain.data.failed}
              tone={drain.data.failed > 0 ? "destructive" : "secondary"}
            />
          </span>
        )}
        {heal.data && <Stat label="healed" value={heal.data.healed} />}
        {/* Model picker + search sit together at the far right of the bar. */}
        <div className="ml-auto flex items-center gap-2">
          <ModelPicker
            config={embeddingConfig}
            activeModel={overview?.activeModel}
            coverage={overview?.coverage ?? []}
            pending={setEmbeddingModel.isPending}
            onSelect={setEmbeddingModel.mutate}
          />
          <SearchBar
            query={searchQuery}
            onQueryChange={setSearchQuery}
            tuning={tuning}
            onTuningChange={setTuning}
            searching={searching}
            results={
              isSearching && !searching
                ? { items: matches.size, chunks: hits?.length ?? 0 }
                : null
            }
          />
        </div>
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
              {isSearching
                ? "No items match this search."
                : "No content rows yet — hit “Backfill all items”."}
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
              <MemoTableBody
                rows={visibleRows}
                isResizing={isResizing}
                detailItemId={detailItemId}
                onOpenDetail={handleOpenDetail}
              />
            </table>
          )}
        </div>

        {detailRow && (
          <DetailPane
            // Remount per item so the scroll position resets rather than
            // carrying the previous document's state into the next one. Width
            // lives on the page, so it survives the remount.
            key={detailRow.itemId}
            row={detailRow}
            activeModel={overview?.activeModel}
            onClose={closeDetail}
            width={detailWidth}
            onWidthChange={setDetailWidth}
          />
        )}
      </div>
    </div>
  );
};

export default DebugIntelligencePage;
