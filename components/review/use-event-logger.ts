"use client";

import React from "react";

import { logSessionEvent, type BatchedReviewEvent } from "@/app/actions";
import type { ReviewEvent } from "@/lib/review-events";

// Passing `null` disables logging entirely — used by the debug session preview
// so simulated reviews never hit the server.
//
// card_shown / answer_revealed are pure telemetry, so instead of one server
// action per event (each a full auth + transaction round trip) they queue
// locally; the review session flushes the queue with the next rateCard /
// endReviewSession call, which writes them in the same transaction. Other
// event types (pause/resume/skip) stay immediate — they're rare and some are
// read back by the resume flow. Trade-off: queued events are lost if the tab
// closes before the next flush.
export const useEventLogger = (sessionId: string | null) => {
  const sessionIdRef = React.useRef(sessionId);
  React.useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const queueRef = React.useRef<BatchedReviewEvent[]>([]);

  const log = React.useCallback((event: ReviewEvent) => {
    const id = sessionIdRef.current;
    if (!id) return;
    if (event.type === "card_shown" || event.type === "answer_revealed") {
      queueRef.current.push(event);
      return;
    }
    logSessionEvent(id, event).catch(() => {});
  }, []);

  // Returns up to 50 queued events (the server schema's per-flush cap —
  // exceeding it would fail validation and take the rateCard down with it);
  // any remainder stays queued for the next flush. undefined when empty so
  // callers can pass the result straight into an optional `events` arg.
  const drain = React.useCallback((): BatchedReviewEvent[] | undefined => {
    if (queueRef.current.length === 0) return undefined;
    const drained = queueRef.current.slice(0, 50);
    queueRef.current = queueRef.current.slice(50);
    return drained;
  }, []);

  return { log, drain };
};
