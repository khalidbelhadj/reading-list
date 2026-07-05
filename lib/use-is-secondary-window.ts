import { useEffect, useState } from "react";

// Whether this window was opened from another app window (review window,
// item window) and that window is still around — i.e. "close this window"
// is a meaningful way back. Effect-based so SSR/hydration never sees it true.
export const useIsSecondaryWindow = () => {
  const [isSecondary, setIsSecondary] = useState(false);
  useEffect(() => {
    const opener = window.opener as Window | null;
    setIsSecondary(opener != null && !opener.closed);
  }, []);
  return isSecondary;
};
