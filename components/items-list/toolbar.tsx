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
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import React from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { getReviewStatus, type ReviewMode } from "@/app/actions";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ReviewConfirmDialog } from "./review-confirm-dialog";
import { SettingsMenu } from "./settings-menu";
import { useStartReview } from "./use-start-review";

export const Toolbar = ({
  hasTags,
  onAdd,
  onPasteUrl,
  isCreating = false,
}: {
  hasTags: boolean;
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
  const handleConfirm = React.useCallback(() => {
    if (!pendingMode) return;
    startReview(pendingMode);
  }, [pendingMode, startReview]);
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

  return (
    <div className="relative flex items-center pt-1">
      <SettingsMenu hasTags={hasTags} />

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
                  // Stable key: the count enters once (on first load) and then
                  // updates its text in place. Keying on dueCount would remount
                  // it on every value change, replaying the enter/exit animation.
                  key="due-count"
                  initial={{ width: 0, marginLeft: -6, opacity: 0 }}
                  animate={{ width: "auto", marginLeft: 0, opacity: 1 }}
                  exit={{ width: 0, marginLeft: -6, opacity: 0 }}
                  transition={{
                    type: "tween",
                    duration: 0.25,
                    ease: [0.4, 0, 0.2, 1],
                  }}
                  className="flex justify-end overflow-hidden whitespace-nowrap text-muted-foreground"
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
                ? "All caught up, nothing due"
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
