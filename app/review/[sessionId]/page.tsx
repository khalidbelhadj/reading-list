import { notFound } from "next/navigation";

import { getReviewSession } from "@/app/actions";

import { ReviewSession } from "./review-session";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const data = await getReviewSession(sessionId);
  if (!data) notFound();

  return <ReviewSession initialData={data} sessionId={sessionId} />;
}
