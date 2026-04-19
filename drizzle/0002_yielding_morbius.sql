CREATE TABLE "card_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"flashcard_id" text NOT NULL,
	"rating" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"time_to_reveal_ms" integer,
	"prev_state" text NOT NULL,
	"prev_interval" integer NOT NULL,
	"prev_ease_factor" real NOT NULL,
	"prev_reps" integer NOT NULL,
	"next_state" text NOT NULL,
	"next_interval" integer NOT NULL,
	"next_ease_factor" real NOT NULL,
	"next_due" timestamp with time zone NOT NULL,
	"reviewed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"flashcard_id" text,
	"type" text NOT NULL,
	"data" jsonb,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"scope" jsonb,
	"cards_planned" integer DEFAULT 0 NOT NULL,
	"cards_completed" integer DEFAULT 0 NOT NULL,
	"affects_schedule" boolean DEFAULT true NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN "state" text DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN "due" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN "interval" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN "ease_factor" real DEFAULT 2.5 NOT NULL;--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN "reps" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN "lapses" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN "last_reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "card_reviews" ADD CONSTRAINT "card_reviews_session_id_review_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."review_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_reviews" ADD CONSTRAINT "card_reviews_flashcard_id_flashcards_id_fk" FOREIGN KEY ("flashcard_id") REFERENCES "public"."flashcards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_events" ADD CONSTRAINT "review_events_session_id_review_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."review_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_events" ADD CONSTRAINT "review_events_flashcard_id_flashcards_id_fk" FOREIGN KEY ("flashcard_id") REFERENCES "public"."flashcards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_reviews_user_reviewed_idx" ON "card_reviews" USING btree ("user_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "card_reviews_flashcard_idx" ON "card_reviews" USING btree ("flashcard_id");--> statement-breakpoint
CREATE INDEX "card_reviews_session_idx" ON "card_reviews" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "review_events_session_idx" ON "review_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "review_sessions_user_started_idx" ON "review_sessions" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "flashcards_user_state_due_idx" ON "flashcards" USING btree ("user_id","state","due");