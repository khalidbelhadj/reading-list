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

export type ReviewEventType = ReviewEvent["type"];

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

type Row = {
  type: string;
  flashcardId: string | null;
  data: unknown;
};

export const parseReviewEvent = (row: Row): ReviewEvent => {
  switch (row.type) {
    case "card_shown":
      if (!row.flashcardId)
        throw new Error("card_shown event missing flashcardId");
      return { type: "card_shown", flashcardId: row.flashcardId, data: null };
    case "answer_revealed":
      if (!row.flashcardId)
        throw new Error("answer_revealed event missing flashcardId");
      return {
        type: "answer_revealed",
        flashcardId: row.flashcardId,
        data: row.data as { timeToRevealMs: number },
      };
    case "card_skipped":
      if (!row.flashcardId)
        throw new Error("card_skipped event missing flashcardId");
      return {
        type: "card_skipped",
        flashcardId: row.flashcardId,
        data: row.data as { afterReveal: boolean; durationMs: number },
      };
    case "card_edited_during_review":
      if (!row.flashcardId)
        throw new Error("card_edited_during_review event missing flashcardId");
      return {
        type: "card_edited_during_review",
        flashcardId: row.flashcardId,
        data: row.data as { fieldsChanged: Array<"front" | "back"> },
      };
    case "session_paused":
      return { type: "session_paused", flashcardId: null, data: null };
    case "session_resumed":
      return {
        type: "session_resumed",
        flashcardId: null,
        data: row.data as { pauseDurationMs: number },
      };
    case "session_ended":
      return {
        type: "session_ended",
        flashcardId: null,
        data: row.data as { reason: "completed" | "user_ended" | "abandoned" },
      };
    default:
      throw new Error(`Unknown review event type: ${row.type}`);
  }
};
