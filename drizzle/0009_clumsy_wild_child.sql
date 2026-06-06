DROP INDEX "items_user_position_idx";--> statement-breakpoint
CREATE INDEX "items_user_created_idx" ON "items" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "position";