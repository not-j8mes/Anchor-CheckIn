ALTER TABLE "forms" ADD COLUMN "confirmation_email_enabled" boolean DEFAULT true NOT NULL;
ALTER TABLE "forms" ADD COLUMN "confirmation_email_subject" text;
ALTER TABLE "forms" ADD COLUMN "confirmation_email_message" text;
