import React from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";

import { startReviewSession, type ReviewMode } from "@/app/actions";

export const useStartReview = () => {
  const router = useRouter();
  const [startingMode, setStartingMode] = React.useState<ReviewMode | null>(
    null,
  );
  const mutation = useMutation({
    mutationFn: (mode: ReviewMode) => startReviewSession({ mode, limit: 5 }),
    onSuccess: ({ sessionId, cardCount }) => {
      if (cardCount === 0) {
        setStartingMode(null);
        return;
      }
      router.push(`/review/${sessionId}`);
    },
    onError: () => setStartingMode(null),
  });

  const startReview = React.useCallback(
    (mode: ReviewMode) => {
      setStartingMode(mode);
      mutation.mutate(mode);
    },
    [mutation],
  );

  return { startingMode, startReview };
};
