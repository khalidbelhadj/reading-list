import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Spinner } from "@/components/ui/spinner";
import {
  IconBolt,
  IconChevronDown,
  IconClipboard,
  IconPlus,
  IconSparkles,
} from "@tabler/icons-react";
import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  onAdd,
  onPasteUrl,
  isCreating = false,
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
  onAdd: () => void;
  onPasteUrl: () => void;
  isCreating?: boolean;
}) => {

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
    <div className="flex items-center relative pt-1">
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
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 overflow-hidden"
                disabled={isStarting}
                onClick={handleReviewClick}
                suppressHydrationWarning
              />
            }
          >
            {startingMode === "due" && <Spinner className="size-3" />}
            Review
            <AnimatePresence mode="popLayout" initial={false}>
              {!dueLoading && !dueError && (
                <motion.div
                  key={dueCount}
                  initial={{ width: 0, marginLeft: -6, opacity: 0 }}
                  animate={{ width: "auto", marginLeft: 0, opacity: 1 }}
                  exit={{ width: 0, marginLeft: -6, opacity: 0 }}
                  transition={{
                    type: "tween",
                    duration: 0.25,
                    ease: [0.4, 0, 0.2, 1],
                  }}
                  className="text-muted-foreground whitespace-nowrap overflow-hidden flex justify-end"
                >
                  {dueCount}
                </motion.div>
              )}
            </AnimatePresence>
          </TooltipTrigger>
          <TooltipContent>
            {dueLoading || dueError
              ? "Cards due for review"
              : dueCount === 0
                ? "All caught up — nothing due"
                : `${dueCount} card${dueCount === 1 ? "" : "s"} due for review`}
          </TooltipContent>
        </Tooltip>
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
              <IconSparkles />
              New cards
              {!dueLoading && !dueError && (
                <span className="ml-auto pl-3 text-muted-foreground tabular-nums">
                  {reviewStatus?.newCount ?? 0}
                </span>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCramClick}>
              <IconBolt />
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

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button size="sm" className="ml-1" disabled={isCreating}>
              {isCreating ? <Spinner className="size-3.5" /> : <IconPlus />}
              Add
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onPasteUrl}>
            <IconClipboard />
            Paste URL
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onAdd}>
            <IconPlus />
            New item
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
