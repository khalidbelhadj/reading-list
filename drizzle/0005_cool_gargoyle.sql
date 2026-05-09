ALTER TABLE "flashcards" DROP CONSTRAINT "flashcards_item_id_items_id_fk";
--> statement-breakpoint
ALTER TABLE "items_tags" DROP CONSTRAINT "items_tags_item_id_items_id_fk";
--> statement-breakpoint
ALTER TABLE "items_tags" DROP CONSTRAINT "items_tags_tag_id_tags_id_fk";
--> statement-breakpoint
DROP INDEX "items_user_type_position_idx";--> statement-breakpoint
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items_tags" ADD CONSTRAINT "items_tags_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items_tags" ADD CONSTRAINT "items_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "items_user_position_idx" ON "items" USING btree ("user_id","position");--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "type";