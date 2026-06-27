import React from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  startReviewSession,
  type ReviewMode,
  type ReviewScope,
} from "@/app/actions";

export const useStartReview = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [startingMode, setStartingMode] = React.useState<ReviewMode | null>(
    null,
  );
  const mutation = useMutation({
    mutationFn: (args: { mode: ReviewMode; scope?: ReviewScope }) =>
      startReviewSession(args),
    onSuccess: ({ sessionId, cardCount, data }) => {
      if (cardCount === 0) {
        setStartingMode(null);
        return;
      }
      if (data) {
        queryClient.setQueryData(["review-session", sessionId], data);
      }
      navigate({ to: "/review/$sessionId", params: { sessionId } });
    },
    onError: () => setStartingMode(null),
  });

  const startReview = React.useCallback(
    (mode: ReviewMode, scope?: ReviewScope) => {
      setStartingMode(mode);
      mutation.mutate({ mode, scope });
    },
    [mutation],
  );

  return { startingMode, startReview };
};
