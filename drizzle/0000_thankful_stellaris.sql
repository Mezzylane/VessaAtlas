CREATE TYPE "public"."gender" AS ENUM('men', 'women');--> statement-breakpoint
CREATE TABLE "rate_limit_hits" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ip_hash" text NOT NULL,
	"action_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restrooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"building" text NOT NULL,
	"floor_number" smallint NOT NULL,
	"floor_label" text NOT NULL,
	"wing" text,
	"gender" "gender" NOT NULL,
	"x_coord" integer NOT NULL,
	"y_coord" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restroom_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"comment" text,
	"like_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rating_range" CHECK ("reviews"."rating" BETWEEN 1 AND 10),
	CONSTRAINT "comment_length" CHECK (char_length("reviews"."comment") <= 500)
);
--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_restroom_id_restrooms_id_fk" FOREIGN KEY ("restroom_id") REFERENCES "public"."restrooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rlh_window_idx" ON "rate_limit_hits" USING btree ("ip_hash","action_type","created_at");--> statement-breakpoint
CREATE INDEX "rlh_target_idx" ON "rate_limit_hits" USING btree ("ip_hash","action_type","target_id","created_at");--> statement-breakpoint
CREATE INDEX "restrooms_coord_idx" ON "restrooms" USING btree ("x_coord","y_coord");--> statement-breakpoint
CREATE INDEX "reviews_helpful_idx" ON "reviews" USING btree ("restroom_id","like_count","created_at");