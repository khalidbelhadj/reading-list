// One <th>: the column title, a sort indicator, and a menu for sorting and
// pinning. Reordering is native HTML5 drag-and-drop on the header itself —
// no dnd library for a debug grid, and the drag payload is just the column id.
import {
  IconDotsVertical,
  IconPinned,
  IconPinnedOff,
  IconSortAscending,
  IconSortDescending,
} from "@tabler/icons-react";
import { type Header } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import React from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { type IntelligenceRow } from "./columns";

const DRAG_MIME = "text/x-column-id";

export const HeaderCell = ({
  header,
  onReorder,
  style,
  className,
}: {
  header: Header<IntelligenceRow, unknown>;
  onReorder: (sourceId: string, targetId: string) => void;
  style: React.CSSProperties;
  className?: string;
}) => {
  const { column } = header;
  // The checkbox column is structural — it neither moves nor unpins.
  const isFixed = column.id === "select";
  const [dropTarget, setDropTarget] = React.useState(false);
  // The <th> is draggable for reordering, so a mousedown on the resize grip
  // would otherwise start a column drag as well. Set on grab, checked in
  // onDragStart, cleared once the pointer is released anywhere.
  const resizingRef = React.useRef(false);
  React.useEffect(() => {
    const clear = () => {
      resizingRef.current = false;
    };
    window.addEventListener("pointerup", clear);
    return () => window.removeEventListener("pointerup", clear);
  }, []);

  const sorted = column.getIsSorted();
  const pinned = column.getIsPinned();

  return (
    <th
      style={style}
      draggable={!isFixed}
      onDragStart={(event) => {
        if (resizingRef.current) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.setData(DRAG_MIME, column.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(event) => {
        if (isFixed || !event.dataTransfer.types.includes(DRAG_MIME)) return;
        event.preventDefault();
        setDropTarget(true);
      }}
      onDragLeave={() => setDropTarget(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDropTarget(false);
        const sourceId = event.dataTransfer.getData(DRAG_MIME);
        if (sourceId && sourceId !== column.id) onReorder(sourceId, column.id);
      }}
      className={cn(
        "group/header relative border-b border-border bg-background px-2 py-2 text-left align-middle font-medium",
        // A shade of its own — lighter than the row text, darker than the
        // muted body columns, so the header row reads as a distinct band.
        "text-foreground/70",
        !isFixed && "cursor-grab active:cursor-grabbing",
        dropTarget && "border-l-2 border-l-primary",
        className,
      )}
    >
      <div className="flex items-center gap-1">
        {/* Only sortable headers are buttons. The select column's header is a
            checkbox, and wrapping it in a disabled button made it unclickable
            (and nested two interactive controls). */}
        {column.getCanSort() ? (
          <Button
            variant="ghost"
            size="sm"
            className="min-w-0 flex-1 justify-start px-1 font-medium text-inherit"
            onClick={column.getToggleSortingHandler()}
          >
            <span className="truncate">
              {flexRender(column.columnDef.header, header.getContext())}
            </span>
          </Button>
        ) : (
          <span className="min-w-0 flex-1 truncate px-1">
            {flexRender(column.columnDef.header, header.getContext())}
          </span>
        )}
        {sorted &&
          (sorted === "asc" ? (
            <IconSortAscending className="size-3 shrink-0 text-muted-foreground" />
          ) : (
            <IconSortDescending className="size-3 shrink-0 text-muted-foreground" />
          ))}
        {pinned && !isFixed && (
          <IconPinned className="size-3 shrink-0 text-muted-foreground" />
        )}
        {!isFixed && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="shrink-0 opacity-0 group-hover/header:opacity-100 aria-expanded:opacity-100"
                  aria-label={`${column.id} column options`}
                />
              }
            >
              <IconDotsVertical />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {column.getCanSort() && (
                <>
                  <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
                    <IconSortAscending />
                    Sort ascending
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
                    <IconSortDescending />
                    Sort descending
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => column.pin("left")}>
                <IconPinned />
                Pin left
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => column.pin("right")}>
                <IconPinned />
                Pin right
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => column.pin(false)}
                disabled={!pinned}
              >
                <IconPinnedOff />
                Unpin
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {column.getCanResize() && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={`Resize ${column.id}`}
          onMouseDown={(event) => {
            resizingRef.current = true;
            header.getResizeHandler()(event);
          }}
          onTouchStart={(event) => {
            resizingRef.current = true;
            header.getResizeHandler()(event);
          }}
          onDoubleClick={() => column.resetSize()}
          onClick={(event) => event.stopPropagation()}
          className={cn(
            "absolute inset-y-0 -right-1.5 z-10 w-3 cursor-col-resize touch-none select-none",
            "before:absolute before:inset-y-1.5 before:left-1/2 before:w-0.75 before:-translate-x-1/2 before:rounded-full before:transition-colors",
            column.getIsResizing()
              ? "before:bg-foreground/70"
              : "before:bg-transparent hover:before:bg-muted-foreground/50",
          )}
        />
      )}
    </th>
  );
};
