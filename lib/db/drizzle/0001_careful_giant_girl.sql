CREATE TABLE "family_event_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"registration_group_id" integer NOT NULL,
	"label_code" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "printer_ip" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "printer_name" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "printing_mode" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "checkins" ADD COLUMN "checkout_method" text;--> statement-breakpoint
ALTER TABLE "checkins" ADD COLUMN "checkout_reason" text;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "medical_notes" text;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "emergency_contact_name" text;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "emergency_contact_phone" text;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "emergency_contact_relationship" text;--> statement-breakpoint
ALTER TABLE "family_event_codes" ADD CONSTRAINT "family_event_codes_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_event_codes" ADD CONSTRAINT "family_event_codes_registration_group_id_registration_groups_id_fk" FOREIGN KEY ("registration_group_id") REFERENCES "public"."registration_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fec_event_group_unique" ON "family_event_codes" USING btree ("event_id","registration_group_id");