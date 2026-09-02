CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"court_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"player_count" integer DEFAULT 4 NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"surface" text DEFAULT 'Cushioned acrylic' NOT NULL,
	"indoor" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "open_play_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'registered' NOT NULL,
	"court_id" uuid,
	"queue_position" integer DEFAULT 0 NOT NULL,
	"checked_in_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "open_play_session_courts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"court_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "open_play_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"skill_level" text DEFAULT 'all' NOT NULL,
	"players_per_court" integer DEFAULT 4 NOT NULL,
	"fee_cents" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'player' NOT NULL,
	"skill_level" text DEFAULT 'beginner' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_court_id_courts_id_fk" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_play_registrations" ADD CONSTRAINT "open_play_registrations_session_id_open_play_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."open_play_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_play_registrations" ADD CONSTRAINT "open_play_registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_play_registrations" ADD CONSTRAINT "open_play_registrations_court_id_courts_id_fk" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_play_session_courts" ADD CONSTRAINT "open_play_session_courts_session_id_open_play_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."open_play_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_play_session_courts" ADD CONSTRAINT "open_play_session_courts_court_id_courts_id_fk" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_play_sessions" ADD CONSTRAINT "open_play_sessions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_court_start_idx" ON "bookings" USING btree ("court_id","starts_at");--> statement-breakpoint
CREATE INDEX "bookings_user_start_idx" ON "bookings" USING btree ("user_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_court_slot_unique" ON "bookings" USING btree ("court_id","starts_at") WHERE status = 'confirmed';--> statement-breakpoint
CREATE UNIQUE INDEX "courts_label_unique" ON "courts" USING btree ("label");--> statement-breakpoint
CREATE UNIQUE INDEX "open_play_registrations_unique" ON "open_play_registrations" USING btree ("session_id","user_id");--> statement-breakpoint
CREATE INDEX "open_play_registrations_session_idx" ON "open_play_registrations" USING btree ("session_id","status");--> statement-breakpoint
CREATE INDEX "open_play_registrations_user_idx" ON "open_play_registrations" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "open_play_session_courts_unique" ON "open_play_session_courts" USING btree ("session_id","court_id");--> statement-breakpoint
CREATE INDEX "open_play_sessions_start_idx" ON "open_play_sessions" USING btree ("starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");