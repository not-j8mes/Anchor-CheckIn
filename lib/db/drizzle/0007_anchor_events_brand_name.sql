ALTER TABLE "organizations" ALTER COLUMN "name" SET DEFAULT 'Anchor Events';--> statement-breakpoint
UPDATE "organizations"
SET "name" = 'Anchor Events'
WHERE "name" = 'Anchor Events - Check In and Registration';
