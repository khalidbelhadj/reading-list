// The PDF engine's own control bar: sidebar toggle, page navigation, zoom,
// rotation, download. Engine-specific by design — the reading panel's header
// stays the minimal close/URL/open-external strip it has always been.
import {
  IconChevronDown,
  IconChevronUp,
  IconDownload,
  IconLayoutSidebar,
  IconMinus,
  IconPlus,
  IconRotateClockwise,
} from "@tabler/icons-react";
import React from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { type PdfZoom } from "./use-pdf-viewer";

const ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

const ToolbarButton = ({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) => (
  <Tooltip>
    <TooltipTrigger
      render={
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn(
            "text-muted-foreground",
            active && "bg-muted text-foreground",
          )}
          onClick={onClick}
          aria-label={label}
        />
      }
    >
      {children}
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);

export const PdfToolbar = ({
  currentPage,
  pageCount,
  scale,
  zoom,
  sidebarOpen,
  downloadUrl,
  downloadName,
  onToggleSidebar,
  onGoToPage,
  onZoomStep,
  onSetZoom,
  onRotate,
}: {
  currentPage: number;
  pageCount: number;
  scale: number;
  zoom: PdfZoom;
  sidebarOpen: boolean;
  downloadUrl: string;
  downloadName: string;
  onToggleSidebar: () => void;
  onGoToPage: (page: number) => void;
  onZoomStep: (direction: 1 | -1) => void;
  onSetZoom: (zoom: PdfZoom) => void;
  onRotate: () => void;
}) => {
  // The page box is a text field the reader can type into, so it holds a draft
  // while focused and snaps back to the live page the moment it isn't.
  const [draft, setDraft] = React.useState<string | null>(null);
  const value = draft ?? String(currentPage);

  const commit = React.useCallback(
    (raw: string) => {
      const parsed = Number.parseInt(raw, 10);
      setDraft(null);
      if (Number.isFinite(parsed)) {
        onGoToPage(Math.min(Math.max(1, parsed), pageCount));
      }
    },
    [onGoToPage, pageCount],
  );

  const zoomLabel =
    zoom.mode === "fit-width"
      ? "Fit width"
      : zoom.mode === "fit-page"
        ? "Fit page"
        : `${Math.round(scale * 100)}%`;

  return (
    <div className="pdf-toolbar flex h-9 shrink-0 items-center gap-0.5 border-b border-border/60 px-1.5">
      <ToolbarButton
        label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        onClick={onToggleSidebar}
        active={sidebarOpen}
      >
        <IconLayoutSidebar />
      </ToolbarButton>
      <Separator orientation="vertical" className="mx-1 my-2.5 self-stretch" />

      <ToolbarButton
        label="Previous page"
        onClick={() => onGoToPage(currentPage - 1)}
      >
        <IconChevronUp />
      </ToolbarButton>
      <ToolbarButton
        label="Next page"
        onClick={() => onGoToPage(currentPage + 1)}
      >
        <IconChevronDown />
      </ToolbarButton>
      <div className="flex items-center gap-1 px-1 text-xs text-muted-foreground">
        <Input
          value={value}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              setDraft(null);
              event.currentTarget.blur();
            }
          }}
          inputMode="numeric"
          aria-label="Page number"
          // The compact toolbar cut of the shared Input: no chrome of its
          // own beyond the pill, sized to the widest plausible page count.
          className="h-auto w-8 rounded-sm border-0 bg-muted/60 px-1 py-0.5 text-center font-mono text-xs text-foreground tabular-nums shadow-none"
        />
        <span className="font-mono tabular-nums">/ {pageCount}</span>
      </div>

      <Separator orientation="vertical" className="mx-1 my-2.5 self-stretch" />

      <ToolbarButton label="Zoom out" onClick={() => onZoomStep(-1)}>
        <IconMinus />
      </ToolbarButton>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="min-w-16 font-mono text-xs text-muted-foreground tabular-nums"
            />
          }
        >
          {zoomLabel}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center">
          <DropdownMenuItem
            onClick={() => onSetZoom({ mode: "fit-width", value: scale })}
          >
            Fit width
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onSetZoom({ mode: "fit-page", value: scale })}
          >
            Fit page
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {ZOOM_PRESETS.map((preset) => (
            <DropdownMenuItem
              key={preset}
              onClick={() => onSetZoom({ mode: "custom", value: preset })}
            >
              {Math.round(preset * 100)}%
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <ToolbarButton label="Zoom in" onClick={() => onZoomStep(1)}>
        <IconPlus />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 my-2.5 self-stretch" />

      <ToolbarButton label="Rotate" onClick={onRotate}>
        <IconRotateClockwise />
      </ToolbarButton>

      <div className="flex-1" />

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              nativeButton={false}
              render={
                <a
                  href={downloadUrl}
                  download={downloadName}
                  aria-label="Download"
                />
              }
            />
          }
        >
          <IconDownload />
        </TooltipTrigger>
        <TooltipContent>Download</TooltipContent>
      </Tooltip>
    </div>
  );
};
