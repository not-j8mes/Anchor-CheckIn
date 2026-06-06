import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { formsTable } from "./forms";

/**
 * form_versions — a frozen snapshot of a form's fields taken at registration
 * submission time.  Each unique field configuration gets exactly one version row
 * (identified by fields_hash), so if the form hasn't changed between two
 * submissions they share the same version.
 */
export const formVersionsTable = pgTable("form_versions", {
  id: serial("id").primaryKey(),
  formId: integer("form_id")
    .notNull()
    .references(() => formsTable.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  /** Short hash of the serialised field set — used for deduplication. */
  fieldsHash: text("fields_hash"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * form_version_fields — the frozen field rows that belong to a version.
 * original_field_id is a soft reference back to form_fields.id; it is left
 * intentionally without a FK so the snapshot survives field deletion.
 */
export const formVersionFieldsTable = pgTable("form_version_fields", {
  id: serial("id").primaryKey(),
  formVersionId: integer("form_version_id")
    .notNull()
    .references(() => formVersionsTable.id, { onDelete: "cascade" }),
  originalFieldId: integer("original_field_id"),
  fieldKind: text("field_kind").notNull().default("custom"),
  systemKey: text("system_key"),
  label: text("label").notNull(),
  fieldType: text("field_type").notNull().default("text"),
  placeholder: text("placeholder"),
  required: boolean("required").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  options: text("options"),
});

export const insertFormVersionSchema = createInsertSchema(formVersionsTable).omit({
  id: true,
  createdAt: true,
});
export const insertFormVersionFieldSchema = createInsertSchema(formVersionFieldsTable).omit({
  id: true,
});

export type FormVersion = typeof formVersionsTable.$inferSelect;
export type FormVersionField = typeof formVersionFieldsTable.$inferSelect;
export type InsertFormVersion = z.infer<typeof insertFormVersionSchema>;
export type InsertFormVersionField = z.infer<typeof insertFormVersionFieldSchema>;
