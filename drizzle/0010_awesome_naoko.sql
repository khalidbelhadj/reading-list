ALTER TABLE "flashcards" DROP CONSTRAINT "flashcards_item_id_items_id_fk";
--> statement-breakpoint
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;