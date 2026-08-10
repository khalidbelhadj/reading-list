import { sql } from "drizzle-orm";

import { withUser } from "@/db";

export type ReviewEvent =
  | { type: "card_shown"; flashcardId: string; data: null }
  | {
      type: "answer_revealed";
      flashcardId: string;
      data: { timeToRevealMs: number };
    }
  | {
      type: "card_skipped";
      flashcardId: string;
      data: { afterReveal: boolean; durationMs: number };
    }
  | {
      type: "card_edited_during_review";
      flashcardId: string;
      data: { fieldsChanged: Array<"front" | "back"> };
    }
  | { type: "session_paused"; flashcardId: null; data: null }
  | {
      type: "session_resumed";
      flashcardId: null;
      data: { pauseDurationMs: number };
    }
  | {
      type: "session_ended";
      flashcardId: null;
      data: { reason: "completed" | "user_ended" | "abandoned" };
    };

export const logReviewEvent = async (
  userId: string,
  sessionId: string,
  event: ReviewEvent,
): Promise<void> => {
  const now = new Date().toISOString();
  await withUser(
    userId,
    async (tx) => {
      // Single INSERT gated on session ownership — the WHERE EXISTS replaces
      // the old pre-SELECT round trip. RETURNING tells us whether the gate
      // passed so "session not found" still surfaces as an error.
      const inserted = await tx.execute(sql`
        INSERT INTO review_events (user_id, session_id, flashcard_id, type, data, created_at)
        SELECT ${userId}, ${sessionId}, ${event.flashcardId}::text,
               ${event.type}, ${JSON.stringify(event.data)}::jsonb, ${now}::timestamptz
        WHERE EXISTS (
          SELECT 1 FROM review_sessions
          WHERE id = ${sessionId} AND user_id = ${userId}
        )
        RETURNING id
      `);
      if (inserted.length === 0) throw new Error("Review session not found");
    },
    "logReviewEvent",
  );
};
