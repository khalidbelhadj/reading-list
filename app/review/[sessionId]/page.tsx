import { ReviewSession } from "./review-session";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <ReviewSession sessionId={sessionId} />;
}
