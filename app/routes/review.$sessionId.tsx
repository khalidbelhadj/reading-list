import { createFileRoute } from "@tanstack/react-router";

import { ReviewSession } from "@/components/review/review-session";

const ReviewSessionRoute = () => {
  const { sessionId } = Route.useParams();
  return <ReviewSession sessionId={sessionId} />;
};

export const Route = createFileRoute("/review/$sessionId")({
  component: ReviewSessionRoute,
});
