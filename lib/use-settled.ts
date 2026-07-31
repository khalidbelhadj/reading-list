import React from "react";

// Trails `value`, settling only once it has been still for `delay` ms. Used by
// the PDF viewer to hold expensive reactions (rasterizing, thumbnail redraws)
// back while a zoom or a panel drag is still moving.
export const useSettled = <T>(value: T, delay: number): T => {
  const [settled, setSettled] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
};
