import { pgTable, serial, text, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { formsTable } from "./forms";
import { organizationsTable } from "./organizations";

/**
 * form_fields — the new field model that supports both system fields (which map
 * to structured participant/guardian DB columns via system_key) and custom
 * questions (which save answers to registration_custom_answers).
 *
 * field_kind: 'system' | 'custom'
 *
 * System keys follow the pattern:  <entity>.<attribute>
 *   participant.first_name      participant.last_name       participant.date_of_birth
 *   participant.gender          participant.grade           participant.allergies
 *   participant.medical_notes   participant.special_needs   participant.notes
 *   guardian.full_name          guardian.first_name         guardian.last_name
 *   guardian.email              guardian.phone              guardian.relationship
 *   emergency_contact.name      emergency_contact.phone     emergency_contact.relationship
 *   pickup.authorized_name      pickup.authorized_phone
 */
export const formFieldsTable = pgTable("form_fields", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizationsTable.id, {
    onDelete: "cascade",
  }),
  formId: integer("form_id")
    .notNull()
    .references(() => formsTable.id, { onDelete: "cascade" }),
  fieldKind: text("field_kind").notNull().default("custom"),
  systemKey: text("system_key"),
  label: text("label").notNull(),
  fieldType: text("field_type").notNull().default("text"),
  placeholder: text("placeholder"),
  required: boolean("required").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  options: text("options"),
  sectionKey: text("section_key"),
});

export const insertFormFieldSchema = createInsertSchema(formFieldsTable).omit({ id: true });
export type FormField = typeof formFieldsTable.$inferSelect;
export type InsertFormField = z.infer<typeof insertFormFieldSchema>;
