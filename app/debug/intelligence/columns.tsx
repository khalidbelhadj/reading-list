// Column definitions for the intelligence table. One column per column of the
// underlying item_content row — this is a debug view, so values are rendered
// as close to raw as possible (no humanising of dates, no unit suffixes) and
// the only formatting is a dash for null.
import { type ColumnDef } from "@tanstack/react-table";

import { type ContentOverviewRow } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

// A content row plus the semantic-search scores, which are present only while
// a search is active (the two columns below hide themselves otherwise).
// Similarity is the *best* matching chunk for the item, since the table is
// item-level and the search returns chunk-level hits.
export type IntelligenceRow = ContentOverviewRow & {
  similarity: number | null;
  snippet: string | null;
};

// Columns that only make sense during a semantic search.
export const SEARCH_COLUMNS = ["similarity", "snippet"] as const;

// The columns the sidebar builds facets from, in sidebar order. Every one is
// low-cardinality; free-text columns (title, url, errors) are not filterable.
export const FACET_COLUMNS = [
  "status",
  "queueState",
  "source",
  "extractor",
  "hasEmbedding",
  "embeddingModel",
  "hasError",
] as const;

export const FACET_LABELS: Record<(typeof FACET_COLUMNS)[number], string> = {
  status: "Status",
  queueState: "Queue",
  source: "Source",
  extractor: "Extractor",
  hasEmbedding: "Embedding",
  embeddingModel: "Model",
  hasError: "Error",
};

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"];

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  ok: "secondary",
  pending: "outline",
  failed: "destructive",
  unsupported: "destructive",
};

// Queue states come from the worker's own claim predicate — see
// getIntelligenceOverview. "running" means a worker holds a live lease on the
// row right now; "stuck" means it is pending but out of attempts, so nothing
// will ever pick it up again.
const QUEUE_VARIANTS: Record<string, BadgeVariant> = {
  running: "default",
  queued: "secondary",
  "retry-wait": "outline",
  stuck: "destructive",
};

const Nullable = ({ value }: { value: string | number | null }) =>
  value === null || value === "" ? (
    <span className="text-muted-foreground/50">—</span>
  ) : (
    <>{value}</>
  );

// Numeric cells (words, chunks, attempts) read as counts, so they get the
// same badge treatment as the header's tallies. Zero stays a dash — a badge
// reading "0" is louder than the absence it represents.
const CountBadge = ({ value }: { value: number | null }) =>
  value === null || value === 0 ? (
    <Nullable value={null} />
  ) : (
    <Badge variant="secondary" className="tabular-nums">
      {value.toLocaleString()}
    </Badge>
  );

const mono = "font-mono text-xs";

// The table is `table-layout: fixed` so pinned columns can be positioned from
// accumulated widths (column.getStart) — every column therefore needs an
// explicit size, and cells truncate rather than widening the grid.
const truncate = "block truncate";

export const intelligenceColumns: ColumnDef<IntelligenceRow>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllRowsSelected()}
        indeterminate={table.getIsSomeRowsSelected()}
        onCheckedChange={(checked) => table.toggleAllRowsSelected(!!checked)}
        aria-label="Select all rows"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(checked) => row.toggleSelected(!!checked)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 40,
  },
  {
    accessorKey: "similarity",
    header: "Match",
    size: 130,
    cell: ({ getValue }) => {
      const value = getValue<number | null>();
      if (value === null) return <Nullable value={null} />;
      return (
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-10 shrink-0 overflow-hidden rounded-xs bg-muted">
            <span
              className="block h-full rounded-xs bg-primary"
              style={{ width: `${Math.round(Math.max(0, value) * 100)}%` }}
            />
          </span>
          <span className={cn(mono, "tabular-nums")}>{value.toFixed(3)}</span>
        </span>
      );
    },
  },
  {
    accessorKey: "snippet",
    header: "Matched text",
    size: 360,
    enableSorting: false,
    cell: ({ getValue }) => (
      <span className={cn(truncate, "text-muted-foreground")}>
        <Nullable value={getValue<string | null>()} />
      </span>
    ),
  },
  {
    accessorKey: "itemTitle",
    header: "Title",
    size: 280,
    cell: ({ getValue }) => (
      <span className={truncate}>
        <Nullable value={getValue<string>()} />
      </span>
    ),
  },
  {
    accessorKey: "url",
    header: "URL",
    size: 320,
    cell: ({ getValue }) => (
      <span className={cn(mono, truncate, "text-muted-foreground")}>
        {getValue<string>()}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    size: 110,
    filterFn: "arrIncludesSome",
    cell: ({ getValue }) => {
      const status = getValue<string>();
      return (
        <Badge variant={STATUS_VARIANTS[status] ?? "outline"}>{status}</Badge>
      );
    },
  },
  {
    accessorKey: "queueState",
    header: "Queue",
    size: 120,
    filterFn: "arrIncludesSome",
    cell: ({ getValue }) => {
      const state = getValue<string>();
      if (state === "none") return <Nullable value={null} />;
      return (
        <Badge variant={QUEUE_VARIANTS[state] ?? "outline"}>{state}</Badge>
      );
    },
  },
  {
    accessorKey: "nextRetryAt",
    header: "Next retry at",
    size: 210,
    cell: ({ getValue }) => (
      <span className={cn(mono, truncate, "text-muted-foreground")}>
        <Nullable value={getValue<string | null>()} />
      </span>
    ),
  },
  {
    accessorKey: "source",
    header: "Source",
    size: 100,
    filterFn: "arrIncludesSome",
    cell: ({ getValue }) => (
      <span className={mono}>
        <Nullable value={getValue<string | null>()} />
      </span>
    ),
  },
  {
    accessorKey: "extractor",
    header: "Extractor",
    size: 110,
    filterFn: "arrIncludesSome",
    cell: ({ getValue }) => (
      <span className={mono}>
        <Nullable value={getValue<string | null>()} />
      </span>
    ),
  },
  {
    accessorKey: "wordCount",
    header: "Words",
    size: 90,
    cell: ({ getValue }) => <CountBadge value={getValue<number | null>()} />,
  },
  {
    accessorKey: "chunkCount",
    header: "Chunks",
    size: 90,
    cell: ({ getValue }) => <CountBadge value={getValue<number>()} />,
  },
  {
    // Boolean facets read better as words than as checkmarks, and the filter
    // values in the sidebar are then self-describing.
    id: "hasEmbedding",
    accessorFn: (row) => (row.hasEmbedding ? "yes" : "no"),
    header: "Embedding",
    size: 110,
    filterFn: "arrIncludesSome",
    cell: ({ getValue }) => <span className={mono}>{getValue<string>()}</span>,
  },
  {
    // The model the stored vector was produced with. Vectors from different
    // models are never compared, so a row whose model no longer matches the
    // configured one is due for re-embedding — flag that rather than making
    // the reader diff two strings by eye.
    accessorKey: "embeddingModel",
    header: "Model",
    size: 200,
    filterFn: "arrIncludesSome",
    cell: ({ getValue, row }) => {
      const model = getValue<string | null>();
      if (!model) return <Nullable value={null} />;
      return (
        <span className="inline-flex items-center gap-1">
          <Badge variant="outline" className={mono}>
            {model}
          </Badge>
          {row.original.staleModel && (
            <Badge variant="destructive">stale</Badge>
          )}
        </span>
      );
    },
  },
  {
    accessorKey: "attempts",
    header: "Attempts",
    size: 100,
    cell: ({ getValue }) => <CountBadge value={getValue<number>()} />,
  },
  {
    accessorKey: "fetchedAt",
    header: "Fetched at",
    size: 210,
    cell: ({ getValue }) => (
      <span className={cn(mono, truncate, "text-muted-foreground")}>
        <Nullable value={getValue<string | null>()} />
      </span>
    ),
  },
  {
    // Facet on "does this row have any error at all"; the two error columns
    // below carry the actual text.
    id: "hasError",
    accessorFn: (row) => (row.error || row.embeddingError ? "yes" : "no"),
    header: "Error?",
    size: 90,
    filterFn: "arrIncludesSome",
    cell: ({ getValue }) => <span className={mono}>{getValue<string>()}</span>,
  },
  {
    accessorKey: "error",
    header: "Extract error",
    size: 280,
    cell: ({ getValue }) => (
      <span className={cn(mono, truncate, "text-destructive")}>
        <Nullable value={getValue<string | null>()} />
      </span>
    ),
  },
  {
    accessorKey: "embeddingError",
    header: "Embedding error",
    size: 280,
    cell: ({ getValue }) => (
      <span className={cn(mono, truncate, "text-destructive")}>
        <Nullable value={getValue<string | null>()} />
      </span>
    ),
  },
];
