import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const formsTable = pgTable("forms", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  isPublic: boolean("is_public").notNull().default(true),
  embedSlug: text("embed_slug").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const questionsTable = pgTable("questions", {
  id: serial("id").primaryKey(),
  formId: integer("form_id").notNull().references(() => formsTable.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  type: text("type").notNull().default("text"),
  required: boolean("required").notNull().default(false),
  order: integer("order").notNull().default(0),
  placeholder: text("placeholder"),
  options: text("options"),
  isChildField: boolean("is_child_field").notNull().default(false),
  fieldKey: text("field_key"),
});

export const insertFormSchema = createInsertSchema(formsTable).omit({ id: true, createdAt: true });
export const insertQuestionSchema = createInsertSchema(questionsTable).omit({ id: true });
export type InsertForm = z.infer<typeof insertFormSchema>;
export type Form = typeof formsTable.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Question = typeof questionsTable.$inferSelect;
