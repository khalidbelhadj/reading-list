// Slide-in choreography for panels that enter from off-screen. `entered`
// flips shortly after mount to trigger the CSS transition; `settled` flips
// after the transition's duration so callers can force-remove the transition
// (a stalled compositor can never strand the panel mid-slide).
import React from "react";

export const useSlideIn = (
  durationMs: number,
): { entered: boolean; settled: boolean } => {
  const [entered, setEntered] = React.useState(false);
  const [settled, setSettled] = React.useState(false);

  // setTimeout (not rAF — throttled tabs may never paint) triggers the
  // transition, and `settled` force-removes it after its duration.
  React.useEffect(() => {
    const enterTimer = setTimeout(() => setEntered(true), 10);
    const settleTimer = setTimeout(() => setSettled(true), durationMs + 150);
    return () => {
      clearTimeout(enterTimer);
      clearTimeout(settleTimer);
    };
  }, [durationMs]);

  return { entered, settled };
};
