"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  IconArrowsDiagonal,
  IconArrowsDiagonalMinimize2,
  IconDots,
  IconExternalLink,
  IconPlus,
  IconX,
} from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { type Item } from "@/lib/types";
import { fetchItems } from "@/lib/queries";
import { LoadingFade } from "@/components/ui/loading-fade";

import { DetailPanel, type DetailPanelHandle } from "./detail-panel";
import { DetailPanelSkeleton } from "./detail-panel-skeleton";
import { ItemDropdown } from "./item-dropdown";
import { DeleteItemDialog } from "./delete-item-dialog";
import { useItemMutations } from "./use-item-mutations";
import { type EditFields } from "./utils";

// Open phase machine. "closed" represents both "never opened" and "after
// slide-off"; while closed, the visual layer keeps the dimensions of the
// last open phase so the slide-off animation doesn't reshape content.
export type OpenPhase = "side" | "fullw" | "full";
export type Phase = "closed" | OpenPhase;

const WIDTH_MS = 280; // side ↔ fullw
export const EDGE_MS = 220; // fullw ↔ full
const OPEN_MS = 280; // closed ↔ side (slide in/out)
const PAUSE_MS = 90;
export const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
// Outer spacing is owned by PanelLayout (p-3 / gap-3). 12 here is the slide-off
// distance — how far the panel must translate to clear the layout's outer
// padding when it slides off-screen.
const SLIDE_OFFSET = 12;
const NARROW_BREAKPOINT = 768;

type Orientation = "side" | "bottom";

// Primary axis size in the "side" phase. fullw/full size comes from filling
// the layout container (width/height: 100%) rather than from this function.
const sidePrimaryFor = (o: Orientation) =>
  o === "side" ? "min(50vw, 720px)" : "min(75dvh, 760px)";

const radiusFor = (p: OpenPhase) => (p === "full" ? 0 : 8);

const useIsNarrow = () => {
  // Always start `false` so SSR and the first client render match. The actual
  // viewport is read after hydration in the effect below.
  const [isNarrow, setIsNarrow] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${NARROW_BREAKPOINT - 1}px)`);
    const update = () => setIsNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isNarrow;
};

export const SlidingItemPanel = ({
  itemId,
  onClose,
  expandTrigger,
}: {
  itemId: string | null;
  onClose: () => void;
  // Incremented by the parent to request expand-on-open (Cmd+Enter). Each
  // change triggers exactly one expand once the panel reaches side phase.
  expandTrigger?: number;
}) => {
  // Always start at "closed" so a remount with itemId already set still
  // plays the open animation (closed → side via rAF). Some parent re-mounts
  // happen on URL change.
  const [phase, setPhase] = React.useState<Phase>("closed");
  const [renderedId, setRenderedId] = React.useState<string | null>(null);

  // Remember the last open phase so the visual layer keeps its shape during
  // the slide-off animation (no reshape during close).
  const lastOpenPhaseRef = React.useRef<OpenPhase>("side");
  React.useEffect(() => {
    if (phase !== "closed") lastOpenPhaseRef.current = phase;
  }, [phase]);

  // Open: while phase=closed, an itemId triggers the open animation.
  // setTimeout rather than rAF so the next-tick callback survives the effect
  // cleanup that React fires on rapid re-renders.
  const openTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    if (!itemId) return;
    if (phase === "closed") {
      setRenderedId(itemId);
      if (openTimeoutRef.current === null) {
        openTimeoutRef.current = setTimeout(() => {
          openTimeoutRef.current = null;
          setPhase("side");
        }, 16);
      }
      return;
    }
    setRenderedId((prev) => (itemId !== prev ? itemId : prev));
  }, [itemId, phase]);
  React.useEffect(
    () => () => {
      if (openTimeoutRef.current !== null) {
        clearTimeout(openTimeoutRef.current);
        openTimeoutRef.current = null;
      }
    },
    [],
  );

  // Close: slide off via transform without reshaping content. Single-shot,
  // not dependent on phase so the cleanup doesn't clobber in-flight timers.
  const phaseRef = React.useRef(phase);
  React.useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  React.useEffect(() => {
    if (itemId) return;
    const startPhase = phaseRef.current;
    if (startPhase === "closed") return;
    // From "full" we first restore the insets (full → fullw) so the panel
    // shrinks back to its windowed shape, then slide off. From any other
    // phase we slide off directly.
    const goFromFull = startPhase === "full";
    if (goFromFull) {
      setPhase("fullw");
      const tStage = setTimeout(() => setPhase("closed"), EDGE_MS + PAUSE_MS);
      const tUnmount = setTimeout(
        () => setRenderedId(null),
        EDGE_MS + PAUSE_MS + OPEN_MS,
      );
      return () => {
        clearTimeout(tStage);
        clearTimeout(tUnmount);
      };
    }
    setPhase("closed");
    const tUnmount = setTimeout(() => setRenderedId(null), OPEN_MS);
    return () => clearTimeout(tUnmount);
  }, [itemId]);

  // Expand: side → fullw → full (staged).
  const expandTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const expand = React.useCallback(() => {
    setPhase((p) => (p === "side" ? "fullw" : p));
    if (expandTimerRef.current) clearTimeout(expandTimerRef.current);
    expandTimerRef.current = setTimeout(() => {
      setPhase((p) => (p === "fullw" ? "full" : p));
      expandTimerRef.current = null;
    }, WIDTH_MS + PAUSE_MS);
  }, []);

  const restore = React.useCallback(() => {
    setPhase((p) => (p === "full" ? "fullw" : p));
    if (expandTimerRef.current) clearTimeout(expandTimerRef.current);
    expandTimerRef.current = setTimeout(() => {
      setPhase((p) => (p === "fullw" ? "side" : p));
      expandTimerRef.current = null;
    }, EDGE_MS + PAUSE_MS);
  }, []);

  React.useEffect(
    () => () => {
      if (expandTimerRef.current) clearTimeout(expandTimerRef.current);
    },
    [],
  );

  // Expand-on-open: when expandTrigger changes, queue an expand that fires
  // once the panel reaches side phase. One-shot per trigger change.
  const [pendingExpand, setPendingExpand] = React.useState(false);
  const lastExpandTriggerRef = React.useRef(expandTrigger);
  React.useEffect(() => {
    if (expandTrigger === undefined) return;
    if (expandTrigger !== lastExpandTriggerRef.current) {
      lastExpandTriggerRef.current = expandTrigger;
      setPendingExpand(true);
    }
  }, [expandTrigger]);
  React.useEffect(() => {
    if (pendingExpand && phase === "side") {
      setPendingExpand(false);
      expand();
    }
  }, [pendingExpand, phase, expand]);

  // ESC closes. Bail only when the focused editable is *inside* the panel
  // (e.g. the title/notes editor) — focused inputs elsewhere on the page
  // (like the search bar) should not block closing.
  const visualRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (phase === "closed") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const ae = document.activeElement as HTMLElement | null;
      const isEditable =
        ae &&
        (ae.tagName === "INPUT" ||
          ae.tagName === "TEXTAREA" ||
          ae.isContentEditable);
      if (isEditable && visualRef.current?.contains(ae)) return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, onClose]);

  // Phase used to compute the *visual* layer's dimensions. While closed we
  // freeze on the last open phase so the slide-off keeps the same shape.
  const visualPhase: OpenPhase =
    phase === "closed" ? lastOpenPhaseRef.current : phase;

  const isNarrow = useIsNarrow();
  const orientation: Orientation = isNarrow ? "bottom" : "side";

  // If the orientation flips while the panel is closed (user resized across
  // the breakpoint), suppress transitions for that frame — otherwise the
  // off-screen panel visibly animates across the screen as the transform
  // rotates from right-edge to bottom-edge.
  const prevOrientationRef = React.useRef(orientation);
  const orientationJustChanged = prevOrientationRef.current !== orientation;
  React.useLayoutEffect(() => {
    prevOrientationRef.current = orientation;
  }, [orientation]);
  const suppressTransitions = phase === "closed" && orientationJustChanged;

  const sidePrimary = sidePrimaryFor(orientation);
  const visualRadius = radiusFor(visualPhase);

  // Placeholder reserves flex space so the list shrinks to make room for the
  // panel in side mode. Frozen at the side size regardless of expand state —
  // when expanded, the visual layer overlays the list rather than pushing it.
  // The +SLIDE_OFFSET bakes the visual gap between the list and the panel
  // into the placeholder, since PanelLayout has p-3 but no flex gap.
  const layoutSize =
    phase === "closed"
      ? 0
      : `calc(${sidePrimary} + ${SLIDE_OFFSET}px)`;

  // Animation durations per transition stage. Used both for the per-phase
  // size/position changes and for matching the toolbar's padding transition
  // inside PanelInner so the toolbar settles in sync.
  const ms = (() => {
    if (phase === "closed") return OPEN_MS;
    if (phase === "fullw") return WIDTH_MS;
    if (phase === "full") return EDGE_MS;
    return WIDTH_MS;
  })();

  const sizeProp = orientation === "side" ? "width" : "height";
  const layoutTransition = suppressTransitions
    ? "none"
    : `${sizeProp} ${OPEN_MS}ms ${EASE}`;

  const visualTransition = suppressTransitions
    ? "none"
    : [
        `transform ${OPEN_MS}ms ${EASE}`,
        `top ${ms}ms ${EASE}`,
        `right ${ms}ms ${EASE}`,
        `bottom ${ms}ms ${EASE}`,
        `left ${ms}ms ${EASE}`,
        `width ${ms}ms ${EASE}`,
        `height ${ms}ms ${EASE}`,
        `border-radius ${ms}ms ${EASE}`,
      ].join(", ");

  const visualTransform =
    phase === "closed"
      ? orientation === "side"
        ? `translate3d(calc(100% + ${SLIDE_OFFSET}px), 0, 0)`
        : `translate3d(0, calc(100% + ${SLIDE_OFFSET}px), 0)`
      : "translate3d(0px, 0px, 0px)";

  // Fixed positioning relative to the viewport. Each phase has explicit,
  // viewport-anchored values so the panel animates its own dimensions/offsets
  // independently of any parent reflow — this avoids the stutter that
  // happened when the panel's size was driven by an animating parent.
  //
  //   side: panel sits in the corner with SLIDE_OFFSET breathing room
  //   fullw: panel fills the layout's padded area (still SLIDE_OFFSET in)
  //   full: panel goes edge-to-edge (SLIDE_OFFSET → 0)
  const visualPosition: React.CSSProperties = (() => {
    if (orientation === "side") {
      if (visualPhase === "full") {
        return { top: 0, right: 0, bottom: 0, width: "100vw" };
      }
      if (visualPhase === "fullw") {
        return {
          top: SLIDE_OFFSET,
          right: SLIDE_OFFSET,
          bottom: SLIDE_OFFSET,
          width: `calc(100vw - ${SLIDE_OFFSET * 2}px)`,
        };
      }
      return {
        top: SLIDE_OFFSET,
        right: SLIDE_OFFSET,
        bottom: SLIDE_OFFSET,
        width: sidePrimary,
      };
    }
    if (visualPhase === "full") {
      return { left: 0, right: 0, bottom: 0, height: "100dvh" };
    }
    if (visualPhase === "fullw") {
      return {
        left: SLIDE_OFFSET,
        right: SLIDE_OFFSET,
        bottom: SLIDE_OFFSET,
        height: `calc(100dvh - ${SLIDE_OFFSET * 2}px)`,
      };
    }
    return {
      left: SLIDE_OFFSET,
      right: SLIDE_OFFSET,
      bottom: SLIDE_OFFSET,
      height: sidePrimary,
    };
  })();

  return (
    <>
      {/* Layout placeholder — reserves flex space so the list shrinks to
          make room for the panel; animates to 0 on close. Invisible. */}
      <div
        aria-hidden
        className="flex-none"
        style={{
          width: orientation === "side" ? layoutSize : "auto",
          height: orientation === "bottom" ? layoutSize : "auto",
          transition: layoutTransition,
        }}
      />

      {/* Visual panel — fixed positioning so the panel's own transitions
          drive every visual change, with no dependency on parent layout. */}
      <div
        ref={visualRef}
        data-phase={phase}
        className={cn(
          "fixed flex flex-col overflow-hidden bg-card pointer-events-auto",
          phase !== "closed" && "border border-border shadow-sm",
        )}
        style={{
          ...visualPosition,
          borderRadius: visualRadius,
          transform: visualTransform,
          transition: visualTransition,
          zIndex: 30,
        }}
      >
        {renderedId && (
          <PanelInner
            itemId={renderedId}
            onClose={onClose}
            phase={phase}
            onExpand={expand}
            onRestore={restore}
          />
        )}
      </div>
    </>
  );
};

const PanelInner = ({
  itemId,
  onClose,
  phase,
  onExpand,
  onRestore,
}: {
  itemId: string;
  onClose: () => void;
  phase: Phase;
  onExpand: () => void;
  onRestore: () => void;
}) => {
  const { data: items } = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: fetchItems,
    staleTime: Infinity,
  });
  const item = items?.find((i) => i.id === itemId) ?? null;

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const detailRef = React.useRef<DetailPanelHandle>(null);

  const { toggleReadMutation, togglePinMutation, deleteMutation, updateMutation } =
    useItemMutations();

  const handleSave = React.useCallback(
    (id: string, fields: EditFields) => {
      const tagNames = fields.tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      updateMutation.mutate({
        itemId: id,
        fields: {
          title: fields.title,
          url: fields.url,
          notes: fields.notes,
          tagNames,
        },
      });
    },
    [updateMutation],
  );

  const handleTogglePin = React.useCallback(() => {
    if (!item) return;
    togglePinMutation.mutate({ itemId: item.id, starred: !item.starred });
  }, [item, togglePinMutation]);

  const handleToggleRead = React.useCallback(() => {
    if (!item) return;
    toggleReadMutation.mutate({ itemId: item.id, read: !item.read });
  }, [item, toggleReadMutation]);

  const handleDelete = React.useCallback(async () => {
    if (!item) return;
    setDeleting(true);
    try {
      await deleteMutation.mutateAsync(item.id);
    } finally {
      setDeleteOpen(false);
      setDeleting(false);
    }
    onClose();
  }, [item, deleteMutation, onClose]);

  const isExpanded = phase === "full" || phase === "fullw";

  return (
    <>
      <div
        className={cn(
          "sticky top-0 z-10 flex items-center gap-0.5 bg-inherit transition-[padding] duration-[220ms] ease-[cubic-bezier(0.32,0.72,0,1)]",
          // In "full" mode the panel has lost its outer margins, so put the
          // same inset back as internal padding — the buttons stay at the
          // same absolute position as the margin animates away.
          phase === "full" && "pt-3 pr-3 pl-3",
          // The panel toolbar is always a window drag region in Electron
          // (you can grab anywhere along the top bar to move the window).
          "electron-top-bar-inset",
          // Reserve macOS traffic-light space once the panel starts covering
          // the top-left of the window. `panel-toolbar` forces the 80px
          // clearance regardless of viewport width (see globals.css). In
          // side mode the panel is on the right edge and doesn't need it.
          (phase === "fullw" || phase === "full") && "panel-toolbar",
        )}
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground"
                onClick={onClose}
              />
            }
          >
            <IconX />
          </TooltipTrigger>
          <TooltipContent>Close</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground"
                onClick={isExpanded ? onRestore : onExpand}
              />
            }
          >
            {isExpanded ? <IconArrowsDiagonalMinimize2 /> : <IconArrowsDiagonal />}
          </TooltipTrigger>
          <TooltipContent>{isExpanded ? "Restore" : "Expand"}</TooltipContent>
        </Tooltip>
        <div className="flex-1" />
        {item?.url && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground"
                  onClick={() => window.open(item.url, "_blank")}
                />
              }
            >
              <IconExternalLink />
            </TooltipTrigger>
            <TooltipContent>Open URL</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground"
                onClick={() => detailRef.current?.startAddingCard()}
              />
            }
          >
            <IconPlus />
          </TooltipTrigger>
          <TooltipContent>Add flashcard</TooltipContent>
        </Tooltip>
        {item ? (
          <ItemDropdown
            item={item}
            onTogglePin={handleTogglePin}
            onToggleRead={handleToggleRead}
            onDelete={() => setDeleteOpen(true)}
          >
            <Tooltip>
              <DropdownMenuTrigger
                render={
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground"
                      />
                    }
                  >
                    <IconDots />
                  </TooltipTrigger>
                }
              />
              <TooltipContent>More options</TooltipContent>
            </Tooltip>
          </ItemDropdown>
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            disabled
          >
            <IconDots />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-175 px-3 pt-1 pb-12">
          <LoadingFade loading={!item} skeleton={<DetailPanelSkeleton />}>
            {item ? (
              <DetailPanel
                ref={detailRef}
                key={item.id}
                item={item}
                isNew={false}
                onSave={handleSave}
                onCreate={() => {}}
                onDelete={() => setDeleteOpen(true)}
              />
            ) : null}
          </LoadingFade>
        </div>
      </div>

      <DeleteItemDialog
        item={item}
        open={deleteOpen}
        deleting={deleting}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
      />
    </>
  );
};
