// Right rail of the intelligence page: everything about one content row that
// doesn't fit in a table cell — the extracted markdown, the chunks exactly as
// they were stored, and the full error text.
//
// A pane rather than a dialog: the point is to read a document *while* the
// table still shows where it sits in the queue, and dialogs take the page's
// focus away from that. Same resize plumbing as the filter sidebar.
import { IconX } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import React from "react";

import { getItemChunks, getItemContent } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePanelResize } from "@/lib/use-panel-resize";
import { cn } from "@/lib/utils";

import { type IntelligenceRow } from "./columns";
import { Stat } from "./stat";

const MIN_WIDTH = 360;
const MAX_WIDTH = 900;
const DEFAULT_WIDTH = 480;

const clampWidth = (width: number) =>
  Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));

const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="font-mono text-xs break-words">{children}</span>
  </div>
);

export const DetailPane = ({
  row,
  activeModel,
  onClose,
}: {
  row: IntelligenceRow;
  // Chunks not on this model are excluded from search — flagged per chunk
  // because a partially re-embedded item is a real intermediate state.
  activeModel: string | undefined;
  onClose: () => void;
}) => {
  const [width, setWidth] = React.useState(DEFAULT_WIDTH);
  const asideRef = React.useRef<HTMLElement>(null);

  const { data: content, isLoading: contentLoading } = useQuery({
    queryKey: ["item-content", row.itemId],
    queryFn: () => getItemContent(row.itemId),
  });
  const { data: chunks, isLoading: chunksLoading } = useQuery({
    queryKey: ["item-chunks", row.itemId],
    queryFn: () => getItemChunks(row.itemId),
  });

  // The rail is flush against the right edge, so the width is the distance
  // from the pointer to that edge. Written straight to the element during the
  // drag; committed to state on release — same pattern as the filter sidebar.
  const applyWidth = React.useCallback((clientX: number) => {
    const next = clampWidth(window.innerWidth - clientX);
    if (asideRef.current) asideRef.current.style.width = `${next}px`;
    return next;
  }, []);
  const { dragging, startResize } = usePanelResize({
    onDrag: applyWidth,
    onEnd: (clientX) => setWidth(applyWidth(clientX)),
  });

  return (
    <aside
      ref={asideRef}
      className="relative flex shrink-0 flex-col border-l border-border"
      style={{ width }}
    >
      <div className="flex items-start gap-2 px-3 py-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="truncate font-content text-sm">
            {row.itemTitle || "Untitled"}
          </p>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {row.url}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Close detail"
        >
          <IconX />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-3 pb-3">
        <Badge variant="outline">{row.status}</Badge>
        {row.queueState !== "none" && (
          <Badge variant="outline">{row.queueState}</Badge>
        )}
        <Stat label="words" value={row.wordCount ?? 0} />
        <Stat label="chunks" value={row.chunkCount} />
        <Stat label="attempts" value={row.attempts} />
      </div>

      <Tabs defaultValue="content" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-3">
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="chunks">Chunks</TabsTrigger>
          <TabsTrigger value="job">Job</TabsTrigger>
        </TabsList>

        <TabsContent
          value="content"
          className="min-h-0 flex-1 overflow-y-auto px-3 py-3"
        >
          {contentLoading ? (
            <Spinner />
          ) : content?.markdown ? (
            <pre className="font-mono text-xs whitespace-pre-wrap text-muted-foreground">
              {content.markdown}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nothing extracted yet.
            </p>
          )}
        </TabsContent>

        <TabsContent
          value="chunks"
          className="min-h-0 flex-1 overflow-y-auto px-3 py-3"
        >
          {chunksLoading ? (
            <Spinner />
          ) : chunks && chunks.length > 0 ? (
            <div className="flex flex-col gap-3">
              {chunks.map((chunk) => (
                <div key={chunk.chunkIndex} className="flex flex-col gap-1">
                  <span className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="tabular-nums">
                      {chunk.chunkIndex}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground">
                      {chunk.model}
                    </span>
                    {activeModel && chunk.model !== activeModel && (
                      <Badge variant="destructive">off-model</Badge>
                    )}
                    <span className="ml-auto font-mono text-xs text-muted-foreground tabular-nums">
                      {chunk.text.length} chars
                    </span>
                  </span>
                  <pre className="rounded-md bg-muted/40 p-2 font-mono text-xs whitespace-pre-wrap">
                    {chunk.text}
                  </pre>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No chunks — this item has not been embedded.
            </p>
          )}
        </TabsContent>

        <TabsContent
          value="job"
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3"
        >
          <Field label="Source">{row.source ?? "—"}</Field>
          <Field label="Extractor">{row.extractor ?? "—"}</Field>
          <Field label="Embedding model">
            {row.embeddingModel ?? "—"}
            {row.staleModel && (
              <Badge variant="destructive" className="ml-1.5">
                stale
              </Badge>
            )}
          </Field>
          <Field label="Fetched at">{row.fetchedAt ?? "—"}</Field>
          <Field label="Next retry at">{row.nextRetryAt ?? "—"}</Field>
          {row.error && (
            <Field label="Extract error">
              <span className="text-destructive">{row.error}</span>
            </Field>
          )}
          {row.embeddingError && (
            <Field label="Embedding error">
              <span className="text-destructive">{row.embeddingError}</span>
            </Field>
          )}
        </TabsContent>
      </Tabs>

      {/* Resize strip straddling the left border — the boundary is the grab
          area, same as the app's other panels. */}
      <div
        role="separator"
        aria-orientation="vertical"
        onPointerDown={startResize}
        className="group/resize absolute inset-y-0 -left-2 z-10 w-4 cursor-col-resize"
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
