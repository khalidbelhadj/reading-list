"use client";

import React from "react";

import { logSessionEvent } from "@/app/actions";
import type { ReviewEvent } from "@/lib/review-events";

export const useEventLogger = (sessionId: string) => {
  const sessionIdRef = React.useRef(sessionId);
  React.useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const log = React.useCallback((event: ReviewEvent) => {
    logSessionEvent(sessionIdRef.current, event).catch(() => {});
  }, []);

  return log;
};
