// A window into the index: how much of the library search can find, why the
// rest can't, and the four buttons that change it.
//
// This used to be a TanStack Table with resizable, reorderable, pinnable
// columns and a faceted sidebar — about 2,000 lines to inspect a few hundred
// rows whose interesting state was spread across five columns. With state as
// one word and failures grouped by a typed reason, there is nothing left to
// facet: a filter with four options and a text box covers it.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { toast } from "sonner";

import {
  getEmbeddingSettings,
  getIntelligenceOverview,
  indexEverything,
  reembedForCurrentModel,
  reindexItems,
  retryFailedItems,
  retryFailureReason,
  semanticSearch,
  setPipelinePaused,
  updateEmbeddingSettings,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { type EmbeddingConfig } from "@/lib/extract/embedding-config";
import { type FailureReason } from "@/lib/extract/failure";

import { DetailPane } from "./detail-pane";
import { FailuresPanel } from "./failures-panel";
import { IndexStatus } from "./index-status";
import { ItemStateList, type StateFilter } from "./item-state-list";
import { ModelPicker } from "./model-picker";
import { DEFAULT_TUNING, SearchBar, type SearchTuning } from "./search-bar";

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

const DebugIntelligencePage = () => {
  const queryClient = useQueryClient();

  const { data: overview, isLoading } = useQuery({
    queryKey: ["intelligence"],
    queryFn: getIntelligenceOverview,
    // Poll while there is work that can change state on its own. The loop
    // owns the work now, so "is anything moving" is a single fact rather than
    // a predicate over three queue states.
    refetchInterval: (query) =>
      (query.state.data?.summary.working ?? 0) > 0 ? 3000 : false,
  });
  const summary = overview?.summary ?? null;

  const { data: embeddingConfig } = useQuery({
    queryKey: ["embedding-settings"],
    queryFn: getEmbeddingSettings,
  });

  const [filter, setFilter] = React.useState<StateFilter>("all");
  const [query, setQuery] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [tuning, setTuning] = React.useState<SearchTuning>(DEFAULT_TUNING);
  const [detailItemId, setDetailItemId] = React.useState<string | null>(null);
  const [detailWidth, setDetailWidth] = React.useState(480);
  const [retryingReason, setRetryingReason] = React.useState<string | null>(
    null,
  );

  const { data: hits, isFetching: searching } = useQuery({
    queryKey: ["semantic-search", searchQuery, tuning.maxChunks],
    queryFn: () => semanticSearch(searchQuery, tuning.maxChunks),
    enabled: searchQuery.length > 0,
  });

  const invalidate = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["intelligence"] });
  }, [queryClient]);

  // Every mutationFn is wrapped rather than passed by reference: React Query
  // calls it with more than the variables, and the generated RPC wrappers are
  // variadic, so a bare reference puts those extras into the serialized
  // payload and the request dies in seroval.
  const pause = useMutation({
    mutationFn: (next: boolean) => setPipelinePaused(next),
    onSuccess: (state) => {
      invalidate();
      toast(state.paused ? "Indexing paused." : "Indexing resumed.");
    },
  });

  const queueAll = useMutation({
    mutationFn: () => indexEverything(),
    onSuccess: ({ queued }) => {
      invalidate();
      toast(
        queued === 0
          ? "Every item is already queued or indexed."
          : `Queued ${plural(queued, "item")}.`,
      );
    },
  });

  const retryAll = useMutation({
    mutationFn: () => retryFailedItems(),
    onSuccess: ({ queued }) => {
      invalidate();
      toast(
        queued === 0
          ? "Nothing to retry — the remaining failures can't be fixed by retrying."
          : `Queued ${plural(queued, "item")} to try again.`,
      );
    },
  });

  const retryReason = useMutation({
    mutationFn: (reason: FailureReason) => retryFailureReason(reason),
    onSettled: () => setRetryingReason(null),
    onSuccess: ({ queued }) => {
      invalidate();
      toast(`Queued ${plural(queued, "item")} to try again.`);
    },
  });

  const reembed = useMutation({
    mutationFn: () => reembedForCurrentModel(),
    onSuccess: ({ queued }) => {
      invalidate();
      toast(
        queued === 0
          ? "Everything is already on the current model."
          : `Queued ${plural(queued, "item")} to re-embed.`,
      );
    },
  });

  const reindex = useMutation({
    mutationFn: (itemIds: string[]) => reindexItems(itemIds),
    onSuccess: ({ queued }) => {
      invalidate();
      toast(`Queued ${plural(queued, "item")} to re-index.`);
    },
  });

  const handleRetryReason = React.useCallback(
    (reason: FailureReason) => {
      setRetryingReason(reason);
      retryReason.mutate(reason);
    },
    [retryReason],
  );

  const handleReindex = React.useCallback(
    (itemId: string) => reindex.mutate([itemId]),
    [reindex],
  );

  const togglePause = React.useCallback(
    () => pause.mutate(!(summary?.paused ?? false)),
    [pause, summary],
  );
  const runQueueAll = React.useCallback(() => queueAll.mutate(), [queueAll]);
  const runRetryAll = React.useCallback(() => retryAll.mutate(), [retryAll]);
  const runReembed = React.useCallback(() => reembed.mutate(), [reembed]);

  const setEmbeddingModel = useMutation({
    mutationFn: (next: EmbeddingConfig) => updateEmbeddingSettings(next),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["embedding-settings"] });
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ["semantic-search"] });
      toast("Model changed. Re-embed to bring the library onto it.");
    },
  });

  // Search narrows the list to matching items; without one, the filter and
  // the text box decide.
  const matchedIds = React.useMemo(() => {
    if (searchQuery.length === 0) return null;
    const ids = new Set<string>();
    for (const hit of hits ?? []) {
      if (hit.similarity >= tuning.minSimilarity) ids.add(hit.itemId);
    }
    return ids;
  }, [hits, searchQuery, tuning.minSimilarity]);

  const rows = React.useMemo(() => overview?.rows ?? [], [overview]);
  const detailRow = React.useMemo(
    () => rows.find((row) => row.itemId === detailItemId) ?? null,
    [rows, detailItemId],
  );
  const closeDetail = React.useCallback(() => setDetailItemId(null), []);

  const anyRetryable = (summary?.failures ?? []).some(
    (group) => group.retryable,
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {/* This page owns the window's top-left corner, so the header reserves
          the macOS traffic-light clearance (no-op on web) and doubles as the
          window drag region. */}
      <header className="electron-top-bar-inset electron-top-bar-text-start panel-toolbar flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
        <h1 className="shrink-0 font-content text-base">Intelligence</h1>
        <IndexStatus summary={summary} />
        <div className="ml-auto flex items-center gap-2">
          <ModelPicker
            config={embeddingConfig}
            pending={setEmbeddingModel.isPending}
            onSelect={setEmbeddingModel.mutate}
          />
          <SearchBar
            query={searchQuery}
            onQueryChange={setSearchQuery}
            tuning={tuning}
            onTuningChange={setTuning}
            searching={searching}
            results={matchedIds ? matchedIds.size : null}
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pause.isPending}
              onClick={togglePause}
            >
              {summary?.paused ? "Resume indexing" : "Pause indexing"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={queueAll.isPending}
              onClick={runQueueAll}
            >
              {queueAll.isPending && <Spinner className="size-3" />}
              Index everything
            </Button>
            {anyRetryable && (
              <Button
                variant="outline"
                size="sm"
                disabled={retryAll.isPending}
                onClick={runRetryAll}
              >
                {retryAll.isPending && <Spinner className="size-3" />}
                Retry what can be retried
              </Button>
            )}
            {(summary?.staleModel ?? 0) > 0 && (
              <Button
                variant="outline"
                size="sm"
                disabled={reembed.isPending}
                onClick={runReembed}
              >
                {reembed.isPending && <Spinner className="size-3" />}
                Re-embed onto {summary?.activeModel}
              </Button>
            )}
          </div>

          <FailuresPanel
            failures={summary?.failures ?? []}
            retryingReason={retryingReason}
            onRetryReason={handleRetryReason}
          />

          {isLoading ? (
            <Spinner />
          ) : (
            <ItemStateList
              rows={rows}
              filter={filter}
              onFilterChange={setFilter}
              query={query}
              onQueryChange={setQuery}
              matchedIds={matchedIds}
              openItemId={detailItemId}
              onOpen={setDetailItemId}
              onReindex={handleReindex}
            />
          )}
        </div>

        {detailRow && (
          <DetailPane
            row={detailRow}
            activeModel={summary?.activeModel}
            width={detailWidth}
            onWidthChange={setDetailWidth}
            onClose={closeDetail}
          />
        )}
      </div>
    </div>
  );
};

export default DebugIntelligencePage;
