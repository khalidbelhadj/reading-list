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
    mutationFn: (args: { mode: ReviewMode; limit: number }) =>
      startReviewSession(args),
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
    (mode: ReviewMode, limit: number) => {
      setStartingMode(mode);
      mutation.mutate({ mode, limit });
    },
    [mutation],
  );

  return { startingMode, startReview };
};
