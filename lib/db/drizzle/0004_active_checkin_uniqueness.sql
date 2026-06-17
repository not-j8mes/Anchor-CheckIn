CREATE UNIQUE INDEX IF NOT EXISTS "checkins_active_registration_session_unique"
  ON "checkins" USING btree ("registration_id", "session_id")
  WHERE "checkout_at" IS NULL AND "session_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "checkins_active_registration_no_session_unique"
  ON "checkins" USING btree ("registration_id")
  WHERE "checkout_at" IS NULL AND "session_id" IS NULL;
