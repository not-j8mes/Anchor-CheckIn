ALTER TABLE "family_event_codes" ADD COLUMN "session_id" integer;--> statement-breakpoint
DROP INDEX IF EXISTS "fec_event_group_unique";--> statement-breakpoint
ALTER TABLE "family_event_codes" ADD CONSTRAINT "family_event_codes_session_id_event_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."event_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fec_event_session_group_unique" ON "family_event_codes" USING btree ("event_id","session_id","registration_group_id");
