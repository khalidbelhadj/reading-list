ALTER TABLE "card_reviews" DROP CONSTRAINT "card_reviews_flashcard_id_flashcards_id_fk";
--> statement-breakpoint
ALTER TABLE "review_events" DROP CONSTRAINT "review_events_flashcard_id_flashcards_id_fk";
--> statement-breakpoint
ALTER TABLE "card_reviews" ADD CONSTRAINT "card_reviews_flashcard_id_flashcards_id_fk" FOREIGN KEY ("flashcard_id") REFERENCES "public"."flashcards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_events" ADD CONSTRAINT "review_events_flashcard_id_flashcards_id_fk" FOREIGN KEY ("flashcard_id") REFERENCES "public"."flashcards"("id") ON DELETE set null ON UPDATE no action;