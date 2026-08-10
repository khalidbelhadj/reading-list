// Keeps the last non-null value rendered for `ms` after it clears, so a
// surface can play an exit transition instead of vanishing the frame its data
// disappears. Callers render `value` and drive the outgoing state from
// `exiting`.
//
// Re-opening with a *different* value during the exit window cancels the exit
// and swaps straight to the new one.
import React from "react";

export const useLinger = <T>(
  value: T | null,
  ms: number,
): { value: T | null; exiting: boolean } => {
  const [lingering, setLingering] = React.useState<T | null>(value);

  React.useEffect(() => {
    if (value !== null) {
      setLingering(value);
      return;
    }
    const timer = setTimeout(() => setLingering(null), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);

  return {
    value: value ?? lingering,
    exiting: value === null && lingering !== null,
  };
};
