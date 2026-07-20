// Shared drag lifecycle for the resizable panels (reading panel + sliding
// item panel). Design goals:
//
// - Zero React state updates during pointer moves: each pointermove calls
//   `onDrag` synchronously so callers mutate styles via refs. No rAF
//   deferral — Chrome/Electron already coalesce pointermove to ~one event
//   per rendering frame, so a rAF hop only added up to a frame of latency
//   between the cursor and the divider; synchronous style writes paint in
//   the same frame the event arrived.
// - Un-stickable teardown: lifecycle listeners live on `window` (pointermove,
//   pointerup, pointercancel, blur) so they survive element re-renders and
//   pointer-capture loss. Teardown is idempotent and also runs on unmount.
// - No React-rendered drag shields: while dragging, the `panel-resizing`
//   body class (see globals.css) sets the resize cursor, disables text
//   selection, and makes iframes/webviews pointer-events: none so embedded
//   documents can't swallow the drag.
import React from "react";

const BODY_CLASS = "panel-resizing";
const BODY_CLASS_ROW = "panel-resizing-row";

type DragSession = {
  lastCoordinate: number;
  teardown: () => void;
};

export const usePanelResize = ({
  axis = "x",
  onDrag,
  onEnd,
}: {
  // "x" resizes horizontally (col-resize, reads clientX); "y" vertically
  // (row-resize, reads clientY — the item panel's bottom orientation).
  axis?: "x" | "y";
  // Called synchronously on every pointermove with the pointer coordinate
  // along `axis`. The browser already frame-aligns pointermove delivery, so
  // synchronous style writes paint in the same frame the event arrived.
  // Mutate styles via refs here — no setState.
  onDrag: (coordinate: number) => void;
  // Called exactly once when the drag ends (pointerup, pointercancel,
  // window blur, or unmount) with the last seen coordinate. Commit state
  // and persist settings here.
  onEnd: (coordinate: number) => void;
}) => {
  const [dragging, setDragging] = React.useState(false);

  // Latest-callback refs so the window listeners never go stale across
  // re-renders without needing to re-bind.
  const onDragRef = React.useRef(onDrag);
  onDragRef.current = onDrag;
  const onEndRef = React.useRef(onEnd);
  onEndRef.current = onEnd;
  const axisRef = React.useRef(axis);
  axisRef.current = axis;

  // Non-null exactly while a drag is active.
  const sessionRef = React.useRef<DragSession | null>(null);

  const stopResize = React.useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    // Clear first so a re-entrant end event (e.g. pointerup + blur in the
    // same tick) is a no-op.
    sessionRef.current = null;
    session.teardown();
    setDragging(false);
    onEndRef.current(session.lastCoordinate);
  }, []);

  const startResize = React.useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      if (sessionRef.current) return;

      const currentAxis = axisRef.current;
      const coordinateOf = (e: { clientX: number; clientY: number }) =>
        currentAxis === "x" ? e.clientX : e.clientY;

      const session: DragSession = {
        lastCoordinate: coordinateOf(event),
        teardown: () => {},
      };

      const handleMove = (moveEvent: PointerEvent) => {
        session.lastCoordinate = coordinateOf(moveEvent);
        onDragRef.current(session.lastCoordinate);
      };
      const handleEnd = () => stopResize();

      session.teardown = () => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleEnd);
        window.removeEventListener("pointercancel", handleEnd);
        window.removeEventListener("blur", handleEnd);
        document.body.classList.remove(BODY_CLASS, BODY_CLASS_ROW);
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleEnd);
      window.addEventListener("pointercancel", handleEnd);
      window.addEventListener("blur", handleEnd);
      document.body.classList.add(BODY_CLASS);
      if (currentAxis === "y") document.body.classList.add(BODY_CLASS_ROW);

      sessionRef.current = session;
      setDragging(true);
    },
    [stopResize],
  );

  // Unmounting mid-drag runs the same idempotent end path, so the body
  // class (and thus the forced cursor / inert iframes) can never leak.
  React.useEffect(() => stopResize, [stopResize]);

  return { dragging, startResize };
};
