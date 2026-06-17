ALTER TABLE "organizations" ALTER COLUMN "name" SET DEFAULT 'Anchor Events - Check In and Registration';--> statement-breakpoint
UPDATE "organizations"
SET "name" = 'Anchor Events - Check In and Registration'
WHERE "name" = 'My Church';
