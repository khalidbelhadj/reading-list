// The PDF sidebar: thumbnails, bookmarks, and search — the three panes every
// desktop PDF reader has, which this viewer previously had none of.
import {
  IconChevronRight,
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

import { PdfThumbnails } from "./pdf-thumbnails";
import { type PdfOutlineNode, resolveOutlinePage } from "./use-pdf-document";
import { type PdfSearch } from "./use-pdf-search";

export type PdfSidebarTab = "thumbnails" | "outline" | "search";

const OutlineRow = ({
  node,
  depth,
  onNavigate,
}: {
  node: PdfOutlineNode;
  depth: number;
  onNavigate: (dest: string | unknown[] | null) => void;
}) => {
  const [open, setOpen] = React.useState(depth === 0);
  const hasChildren = node.items.length > 0;

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
          onClick={() => onNavigate(node.dest)}
          className={cn(
            "min-w-0 flex-1 py-0.5 pr-1 text-left text-xs leading-snug text-foreground/80 hover:text-foreground",
            node.bold && "font-medium",
            node.italic && "italic",
          )}
        >
          {node.title || "Untitled"}
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

      {query.trim().length >= 2 && (
        <p className="px-2 text-[0.6875rem] text-muted-foreground">
          {searching && results.length === 0
            ? "Searching…"
            : `${results.length} result${results.length === 1 ? "" : "s"}${searching ? "…" : ""}`}
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
    (dest: string | unknown[] | null) => {
      void resolveOutlinePage(doc, dest).then((page) => {
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
      <TabsList variant="line" className="mx-2 h-7 justify-start">
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
