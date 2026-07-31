// The PDF sidebar: thumbnails, bookmarks, and search — the three panes every
// desktop PDF reader has, which this viewer previously had none of.
import {
  IconChevronRight,
  IconExternalLink,
  IconLayoutGrid,
  IconListTree,
  IconSearch,
} from "@tabler/icons-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import React from "react";

import { Input } from "@/components/ui/input";
import { NonIdealState } from "@/components/ui/non-ideal-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { type PdfPageSize } from "@/lib/viewer/pdf-layout";
import { type PdfRenderer } from "@/lib/viewer/pdf-render";
import { MIN_SEARCH_QUERY } from "@/lib/viewer/pdf-search";

import { PdfThumbnails } from "./pdf-thumbnails";
import { type PdfOutlineNode, resolveOutlinePage } from "./use-pdf-document";
import { type PdfSearch } from "./use-pdf-search";
import { openExternally } from "./viewer-stage";

export type PdfSidebarTab = "thumbnails" | "outline" | "search";

const OutlineRow = ({
  node,
  depth,
  onNavigate,
}: {
  node: PdfOutlineNode;
  depth: number;
  onNavigate: (node: PdfOutlineNode) => void;
}) => {
  const [open, setOpen] = React.useState(depth === 0);
  const hasChildren = node.items.length > 0;
  // A bookmark is either an in-document destination or an external URL —
  // manuals and reports mix the two freely in one outline.
  const isExternal = !node.dest && !!node.url;

  return (
    <li>
      <div className="flex items-start gap-0.5 rounded-md hover:bg-muted">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((previous) => !previous)}
            aria-label={open ? "Collapse" : "Expand"}
            className="mt-0.5 flex size-4 shrink-0 items-center justify-center text-muted-foreground"
          >
            <IconChevronRight
              className={cn(
                "size-3 transition-transform duration-150",
                open && "rotate-90",
              )}
            />
          </button>
        ) : (
          <span className="size-4 shrink-0" />
        )}
        <button
          type="button"
          onClick={() => onNavigate(node)}
          className={cn(
            "min-w-0 flex-1 py-0.5 pr-1 text-left text-xs leading-snug text-foreground/80 hover:text-foreground",
            node.bold && "font-medium",
            node.italic && "italic",
          )}
        >
          {node.title || "Untitled"}
          {isExternal && (
            <IconExternalLink className="mb-0.5 ml-1 inline size-3 opacity-60" />
          )}
        </button>
      </div>
      {/* Indentation comes from a bordered nested list rather than a computed
          padding, so each level draws its own guide rule and they nest
          automatically however deep the outline goes. The left margin lines
          the rule up under the disclosure chevron above it. */}
      {hasChildren && open && (
        <ul className="ml-2 border-l border-border pl-1.5">
          {node.items.map((child) => (
            <OutlineRow
              key={child.id}
              node={child}
              depth={depth + 1}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

const SearchPane = ({
  search,
  onGoToResult,
}: {
  search: PdfSearch;
  onGoToResult: (index: number) => void;
}) => {
  const { query, setQuery, results, activeIndex, searching } = search;
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const resultsLabel =
    searching && results.length === 0
      ? "Searching…"
      : `${results.length} result${results.length === 1 ? "" : "s"}${searching ? "…" : ""}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="relative px-2">
        <IconSearch className="absolute top-1/2 left-4 size-3 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find in document"
          className="pl-7"
          aria-label="Find in document"
        />
      </div>

      {query.trim().length >= MIN_SEARCH_QUERY && (
        <p className="px-2 text-[0.6875rem] text-muted-foreground">
          {resultsLabel}
        </p>
      )}

      <ul className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
        {results.map((result, index) => (
          <li key={`${result.page}:${result.ordinal}`}>
            <button
              type="button"
              onClick={() => onGoToResult(index)}
              className={cn(
                "w-full rounded-md px-1.5 py-1 text-left text-xs leading-snug",
                index === activeIndex
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60",
              )}
            >
              <span className="mr-1 font-mono text-[0.625rem] tabular-nums opacity-60">
                {result.page}
              </span>
              <span className="opacity-70">…{result.before}</span>
              <mark className="bg-primary/25 text-foreground">
                {result.text}
              </mark>
              <span className="opacity-70">{result.after}…</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const PdfSidebar = ({
  doc,
  renderer,
  sizes,
  outline,
  currentPage,
  tab,
  onTabChange,
  onGoToPage,
  search,
  onGoToResult,
  width,
}: {
  doc: PDFDocumentProxy;
  renderer: PdfRenderer;
  sizes: PdfPageSize[];
  outline: PdfOutlineNode[];
  currentPage: number;
  tab: PdfSidebarTab;
  onTabChange: (tab: PdfSidebarTab) => void;
  onGoToPage: (page: number) => void;
  search: PdfSearch;
  onGoToResult: (index: number) => void;
  width: number;
}) => {
  const handleOutlineNavigate = React.useCallback(
    (node: PdfOutlineNode) => {
      // URL-only bookmarks (a /URI action, no destination) point outside the
      // document — treating them as page jumps made them dead clicks.
      if (!node.dest && node.url) {
        openExternally(node.url);
        return;
      }
      void resolveOutlinePage(doc, node.dest).then((page) => {
        if (page) onGoToPage(page);
      });
    },
    [doc, onGoToPage],
  );

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => onTabChange(value as PdfSidebarTab)}
      className="flex shrink-0 flex-col gap-2 overflow-hidden border-r border-border bg-muted/25 pt-2"
      style={{ width }}
    >
      {/* The wrapper carries the divider so it spans the full rail width;
          the list keeps its inset via padding instead of margin. */}
      <div className="border-b border-border px-2">
        <TabsList variant="line" className="h-7 justify-start">
          <TabsTrigger value="thumbnails">
            <IconLayoutGrid data-icon="inline-start" />
            Pages
          </TabsTrigger>
          <TabsTrigger value="outline">
            <IconListTree data-icon="inline-start" />
            Outline
          </TabsTrigger>
          <TabsTrigger value="search">
            <IconSearch data-icon="inline-start" />
            Search
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent
        value="thumbnails"
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <PdfThumbnails
          renderer={renderer}
          sizes={sizes}
          currentPage={currentPage}
          width={width}
          onSelect={onGoToPage}
        />
      </TabsContent>

      <TabsContent
        value="outline"
        className="min-h-0 flex-1 overflow-y-auto px-1 pb-2"
      >
        {outline.length === 0 ? (
          <NonIdealState
            title="No overview"
            description="This PDF doesn’t include one."
          />
        ) : (
          <ul>
            {outline.map((node) => (
              <OutlineRow
                key={node.id}
                node={node}
                depth={0}
                onNavigate={handleOutlineNavigate}
              />
            ))}
          </ul>
        )}
      </TabsContent>

      <TabsContent
        value="search"
        className="flex min-h-0 flex-1 flex-col overflow-hidden pb-1"
      >
        <SearchPane search={search} onGoToResult={onGoToResult} />
      </TabsContent>
    </Tabs>
  );
};
