import React from "react";

import { cn } from "@/lib/utils";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const readStoredWidth = (key: string | undefined, fallback: number) => {
  if (!key || typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw === null ? NaN : Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

// A frost sidebar docked to the left, resizable by dragging its right edge.
// Width is clamped to [minWidth, maxWidth], remembered under `storageKey`,
// and reset to `defaultWidth` on a double-click of the handle. `open={false}`
// collapses it to nothing (animated); the content keeps its width while the
// frame shrinks so text doesn't reflow mid-slide. In Electron the frost is
// real vibrancy (see use-window-vibrancy.ts); on the web it is a solid quiet
// lift off the background.
export const Sidebar = ({
  defaultWidth = 224,
  minWidth = 180,
  maxWidth = 420,
  open = true,
  storageKey,
  className,
  children,
}: {
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  open?: boolean;
  storageKey?: string;
  className?: string;
  children?: React.ReactNode;
}) => {
  const [width, setWidth] = React.useState(() =>
    clamp(readStoredWidth(storageKey, defaultWidth), minWidth, maxWidth),
  );
  const [dragging, setDragging] = React.useState(false);
  const dragRef = React.useRef<{ startX: number; startWidth: number } | null>(
    null,
  );

  React.useEffect(() => {
    if (!storageKey || dragging) return;
    try {
      window.localStorage.setItem(storageKey, String(width));
    } catch {}
  }, [width, storageKey, dragging]);

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = { startX: event.clientX, startWidth: width };
      setDragging(true);
      // Shared drag state: col-resize cursor everywhere, no text selection,
      // embedded documents inert, transitions off (see globals.css).
      document.body.classList.add("panel-resizing");
    },
    [width],
  );

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      setWidth(
        clamp(
          drag.startWidth + (event.clientX - drag.startX),
          minWidth,
          maxWidth,
        ),
      );
    },
    [minWidth, maxWidth],
  );

  const endDrag = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return;
      dragRef.current = null;
      setDragging(false);
      document.body.classList.remove("panel-resizing");
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [],
  );

  const handleReset = React.useCallback(
    () => setWidth(defaultWidth),
    [defaultWidth],
  );

  return (
    <aside
      data-slot="sidebar"
      data-resizing={dragging ? "" : undefined}
      className={cn(
        "x-sidebar relative flex h-full shrink-0 flex-col overflow-hidden",
        !dragging &&
          "transition-[width] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)]",
        className,
      )}
      style={{ width: open ? width : 0 }}
    >
      {/* Content holds its full width while the frame animates shut. */}
      <div className="flex h-full shrink-0 flex-col" style={{ width }}>
        {children}
      </div>
      {/* The resize handle: a 6px hit area straddling the right edge, with a
          hairline that shows while hovered or dragging. */}
      {open && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          aria-valuenow={width}
          aria-valuemin={minWidth}
          aria-valuemax={maxWidth}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={handleReset}
          className="group/handle absolute inset-y-0 -right-[3px] z-10 w-1.5 cursor-col-resize touch-none select-none"
        >
          <div
            className={cn(
              "absolute inset-y-0 left-[2.5px] w-px transition-opacity duration-150",
              dragging
                ? "bg-foreground/25 opacity-100"
                : "bg-foreground/15 opacity-0 group-hover/handle:opacity-100",
            )}
          />
        </div>
      )}
    </aside>
  );
};
