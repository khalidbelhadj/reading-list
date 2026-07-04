import React from "react";

import { logSessionEvent } from "@/app/actions";
import type { ReviewEvent } from "@/lib/review-events";

// Passing `null` disables logging entirely — used by the debug session preview
// so simulated reviews never hit the server.
export const useEventLogger = (sessionId: string | null) => {
  const sessionIdRef = React.useRef(sessionId);
  React.useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const log = React.useCallback((event: ReviewEvent) => {
    const id = sessionIdRef.current;
    if (!id) return;
    logSessionEvent(id, event).catch(() => {});
  }, []);

  return log;
};
