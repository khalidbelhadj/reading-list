import React from "react";

/**
 * Returns a value that updates `ms` milliseconds after the input stops changing.
 * Useful for keying React Query hooks during rapid keyboard navigation so we
 * only fetch the item the user actually settles on, not every one they pass
 * through.
 */
export const useDebounced = <T,>(value: T, ms: number): T => {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timeout);
  }, [value, ms]);
  return debounced;
};
