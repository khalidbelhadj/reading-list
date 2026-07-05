import React from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  startReviewSession,
  type ReviewMode,
  type ReviewScope,
} from "@/app/actions";
import {
  navigateWindowTo,
  openReviewWindowPlaceholder,
} from "@/lib/app-windows";
import { useSettings } from "@/lib/use-settings";

// With the "Reviews in new window" setting on (the default), reviews run in
// their own window (Electron child window / browser tab) so the list stays
// where it was and the review can hand items back to it. The window opens
// synchronously on the confirm click as a blank placeholder and is pointed
// at the session once the server has created it; if the browser blocked the
// popup — or the setting is off — fall back to navigating this window.
export const useStartReview = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const reviewsInNewWindow = useSettings().settings.reviewsInNewWindow;
  const [startingMode, setStartingMode] = React.useState<ReviewMode | null>(
    null,
  );
  const reviewWindowRef = React.useRef<Window | null>(null);
  const mutation = useMutation({
    mutationFn: (args: { mode: ReviewMode; scope?: ReviewScope }) =>
      startReviewSession(args),
    onSuccess: ({ sessionId, cardCount, data }) => {
      const reviewWindow = reviewWindowRef.current;
      reviewWindowRef.current = null;
      if (cardCount === 0) {
        reviewWindow?.close();
        setStartingMode(null);
        return;
      }
      if (reviewWindow && !reviewWindow.closed) {
        navigateWindowTo(reviewWindow, `/review/${sessionId}`);
        setStartingMode(null);
        return;
      }
      // Seeding the cache only helps the in-window fallback — a new window
      // has its own QueryClient and fetches the session itself.
      if (data) {
        queryClient.setQueryData(["review-session", sessionId], data);
      }
      navigate({ to: "/review/$sessionId", params: { sessionId } });
    },
    onError: () => {
      reviewWindowRef.current?.close();
      reviewWindowRef.current = null;
      setStartingMode(null);
    },
  });

  const startReview = React.useCallback(
    (mode: ReviewMode, scope?: ReviewScope) => {
      setStartingMode(mode);
      reviewWindowRef.current = reviewsInNewWindow
        ? openReviewWindowPlaceholder()
        : null;
      mutation.mutate({ mode, scope });
    },
    [mutation, reviewsInNewWindow],
  );

  return { startingMode, startReview };
};
