ALTER TABLE "events"
  ADD COLUMN "staff_label_last_name_format" text NOT NULL DEFAULT 'full',
  ADD COLUMN "staff_label_show_salutation" boolean NOT NULL DEFAULT true;
