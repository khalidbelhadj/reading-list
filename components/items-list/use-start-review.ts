import React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { startReviewSession, type ReviewMode } from "@/app/actions";

export const useStartReview = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [startingMode, setStartingMode] = React.useState<ReviewMode | null>(
    null,
  );
  const mutation = useMutation({
    mutationFn: (args: { mode: ReviewMode; limit: number }) =>
      startReviewSession(args),
    onSuccess: ({ sessionId, cardCount, data }) => {
      if (cardCount === 0) {
        setStartingMode(null);
        return;
      }
      if (data) {
        queryClient.setQueryData(["review-session", sessionId], data);
      }
      router.push(`/review/${sessionId}`);
    },
    onError: () => setStartingMode(null),
  });

  const startReview = React.useCallback(
    (mode: ReviewMode, limit: number) => {
      setStartingMode(mode);
      mutation.mutate({ mode, limit });
    },
    [mutation],
  );

  return { startingMode, startReview };
};
