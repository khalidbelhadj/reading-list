import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Spinner } from "@/components/ui/spinner";
import { IconChevronDown, IconPlus } from "@tabler/icons-react";
import React from "react";
import { useQuery } from "@tanstack/react-query";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { SettingsMenu } from "./settings-dialog";
import { type TabId, type GroupBy } from "@/components/items-list/use-filters";
import { getReviewStatus, type ReviewMode } from "@/app/actions";
import { useStartReview } from "./use-start-review";
import { ReviewConfirmDialog } from "./review-confirm-dialog";

export const Toolbar = ({
  activeTab,
  setActiveTabAndUrl,
  hasTags,
  tagsOpen,
  setTagsOpen,
  showRead,
  setShowRead,
  groupBy,
  setGroupBy,
  setEditingId,
}: {
  activeTab: TabId;
  setActiveTabAndUrl: (tab: TabId) => void;
  hasTags: boolean;
  tagsOpen: boolean;
  setTagsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  showRead: boolean;
  setShowRead: React.Dispatch<React.SetStateAction<boolean>>;
  groupBy: GroupBy;
  setGroupBy: React.Dispatch<React.SetStateAction<GroupBy>>;
  setEditingId: React.Dispatch<React.SetStateAction<string | null>>;
}) => {
  const handleAddClick = React.useCallback(() => {
    setEditingId("new");
  }, [setEditingId]);

  const {
    data: reviewStatus,
    isLoading: dueLoading,
    isError: dueError,
  } = useQuery({
    queryKey: ["review-status"],
    queryFn: getReviewStatus,
  });
  const dueCount = reviewStatus?.dueCount ?? 0;
  const { startingMode, startReview } = useStartReview();
  const isStarting = startingMode !== null;
  const [pendingMode, setPendingMode] = React.useState<ReviewMode | null>(null);
  const handleReviewClick = React.useCallback(() => {
    if (dueCount === 0 || isStarting) return;
    setPendingMode("due");
  }, [dueCount, isStarting]);
  const handleCramClick = React.useCallback(() => {
    if (isStarting) return;
    setPendingMode("cram");
  }, [isStarting]);
  const handleNewClick = React.useCallback(() => {
    if (isStarting) return;
    setPendingMode("new");
  }, [isStarting]);
  const handleDialogOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open && !isStarting) setPendingMode(null);
    },
    [isStarting],
  );
  const handleConfirm = React.useCallback(
    (limit: number) => {
      if (!pendingMode) return;
      startReview(pendingMode, limit);
    },
    [pendingMode, startReview],
  );
  const wasStartingRef = React.useRef(false);
  React.useEffect(() => {
    if (wasStartingRef.current && !isStarting && pendingMode !== null) {
      setPendingMode(null);
    }
    wasStartingRef.current = isStarting;
  }, [isStarting, pendingMode]);
  const dialogCardCount =
    pendingMode === "cram"
      ? (reviewStatus?.totalCardCount ?? 0)
      : pendingMode === "new"
        ? (reviewStatus?.newCount ?? 0)
        : (reviewStatus?.dueCount ?? 0);
  const dialogItemCount =
    pendingMode === "cram"
      ? (reviewStatus?.totalItemCount ?? 0)
      : pendingMode === "new"
        ? (reviewStatus?.newItemCount ?? 0)
        : (reviewStatus?.dueItemCount ?? 0);

  const showFilters = activeTab !== "cards";

  return (
    <div className="flex items-center relative">
      <SettingsMenu
        activeTab={activeTab}
        setActiveTabAndUrl={setActiveTabAndUrl}
        showFilters={showFilters}
        showReadingListFilters={showFilters}
        hasTags={hasTags}
        tagsOpen={tagsOpen}
        setTagsOpen={setTagsOpen}
        showRead={showRead}
        setShowRead={setShowRead}
        groupBy={groupBy}
        setGroupBy={setGroupBy}
      />

      <div className="flex-1" />

      <ButtonGroup className="ml-1">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={isStarting}
          onClick={handleReviewClick}
          suppressHydrationWarning
        >
          {startingMode === "due" && <Spinner className="size-3" />}
          Review
          {dueLoading || dueError ? null : (
            <div className="text-muted-foreground">{dueCount}</div>
          )}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                className="text-muted-foreground"
                disabled={isStarting}
                aria-label="More review options"
              >
                {startingMode === "cram" || startingMode === "new" ? (
                  <Spinner className="size-3" />
                ) : (
                  <IconChevronDown />
                )}
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleNewClick}>
              New cards
              {!dueLoading && !dueError && (
                <span className="ml-auto pl-3 text-muted-foreground tabular-nums">
                  {reviewStatus?.newCount ?? 0}
                </span>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCramClick}>
              Cram
              {!dueLoading && !dueError && (
                <span className="ml-auto pl-3 text-muted-foreground tabular-nums">
                  {reviewStatus?.totalCardCount ?? 0}
                </span>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>

      <Button size="sm" className="ml-1" onClick={handleAddClick}>
        <IconPlus />
        Add
      </Button>

      <ReviewConfirmDialog
        open={pendingMode !== null}
        onOpenChange={handleDialogOpenChange}
        mode={pendingMode}
        cardCount={dialogCardCount}
        itemCount={dialogItemCount}
        onConfirm={handleConfirm}
        isStarting={isStarting}
      />
    </div>
  );
};
