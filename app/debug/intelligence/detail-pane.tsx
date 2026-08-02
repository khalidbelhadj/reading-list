// Right rail of the intelligence page: everything about one content row that
// doesn't fit in a table cell — its job metadata as key/value pairs, then the
// extracted markdown in a code block.
//
// A pane rather than a dialog: the point is to read a document *while* the
// table still shows where it sits in the queue, and dialogs take the page's
// focus away from that. Same resize plumbing as the filter sidebar.
import { IconX } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import React from "react";

import type { ContentOverviewRow } from "@/app/actions";
import { getItemContent } from "@/app/actions";
import { Favicon } from "@/components/items-list/favicon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { describeFailure } from "@/lib/extract/failure";
import { usePanelResize } from "@/lib/use-panel-resize";
import { cn } from "@/lib/utils";

const MIN_WIDTH = 360;
const MAX_WIDTH = 900;

const clampWidth = (width: number) =>
  Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));

// One metadata row: muted label in the left column, value (wrapping) in the
// right. Rows with a null/empty value are omitted by the caller.
const Row = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <>
    <span className="text-muted-foreground">{label}</span>
    <span className="min-w-0 font-mono break-words">{children}</span>
  </>
);

export const DetailPane = ({
  row,
  activeModel,
  onClose,
  width,
  onWidthChange,
}: {
  row: ContentOverviewRow;
  activeModel: string | undefined;
  onClose: () => void;
  // Owned by the page so it survives this pane's per-item remount.
  width: number;
  onWidthChange: (width: number) => void;
}) => {
  const asideRef = React.useRef<HTMLElement>(null);

  const { data: content, isLoading: contentLoading } = useQuery({
    queryKey: ["item-content", row.itemId],
    queryFn: () => getItemContent(row.itemId),
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
    onEnd: (clientX) => onWidthChange(applyWidth(clientX)),
  });

  const modelOffActive =
    !!row.embeddingModel && !!activeModel && row.embeddingModel !== activeModel;

  return (
    <aside
      ref={asideRef}
      className="relative flex shrink-0 flex-col border-l border-border"
      style={{ width }}
    >
      <div className="flex items-start gap-2 px-3 py-3">
        <Favicon
          item={{ url: row.url, faviconUrl: null }}
          className="mt-0.5 size-4 shrink-0"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="truncate font-content text-sm">
            {row.itemTitle || "Untitled"}
          </p>
          <p className="truncate text-xs text-muted-foreground">{row.url}</p>
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

      <div className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5 px-3 pb-3 text-xs">
        <Row label="state">
          <Badge variant={row.state === "failed" ? "destructive" : "outline"}>
            {row.state}
          </Badge>
        </Row>
        {row.state === "failed" && (
          <Row label="reason">{describeFailure(row.failureReason).label}</Row>
        )}
        <Row label="words">{row.wordCount ?? 0}</Row>
        <Row label="chunks">{row.chunkCount}</Row>
        {row.source && <Row label="source">{row.source}</Row>}
        {row.extractor && <Row label="extractor">{row.extractor}</Row>}
        {row.embeddingModel && (
          <Row label="embedding model">
            {row.embeddingModel}
            {modelOffActive && (
              <Badge variant="destructive" className="ml-1.5">
                off-model
              </Badge>
            )}
          </Row>
        )}
        {row.fetchedAt && <Row label="fetched at">{row.fetchedAt}</Row>}
      </div>

      {row.failureDetail && (
        <div className="border-t border-border px-3 py-3">
          <p className="pb-1.5 text-xs text-muted-foreground">
            What actually happened
          </p>
          {/* Verbatim: status line and response body for an HTTP failure, or
              the exception with its cause chain and stack. Its own block
              rather than a grid cell because it is many lines and the point
              is to be able to read all of them. */}
          <pre className="max-h-64 overflow-auto rounded-md bg-muted/50 p-2 font-mono text-[11px]/relaxed break-words whitespace-pre-wrap text-destructive">
            {row.failureDetail}
          </pre>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-border px-3 py-3">
        {contentLoading ? (
          <Spinner />
        ) : content?.markdown ? (
          <pre className="font-mono text-xs break-words whitespace-pre-wrap">
            {content.markdown}
          </pre>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nothing extracted yet.
          </p>
        )}
      </div>

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
