import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { formsTable } from "./forms";

export const registrationsTable = pgTable("registrations", {
  id: serial("id").primaryKey(),
  formId: integer("form_id").notNull().references(() => formsTable.id, { onDelete: "cascade" }),
  childFirstName: text("child_first_name").notNull(),
  childLastName: text("child_last_name").notNull(),
  childDateOfBirth: text("child_date_of_birth"),
  guardianName: text("guardian_name").notNull(),
  guardianPhone: text("guardian_phone").notNull(),
  guardianEmail: text("guardian_email"),
  allergies: text("allergies"),
  specialNeeds: text("special_needs"),
  room: text("room"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const answersTable = pgTable("answers", {
  id: serial("id").primaryKey(),
  registrationId: integer("registration_id").notNull().references(() => registrationsTable.id, { onDelete: "cascade" }),
  questionId: integer("question_id").notNull(),
  questionLabel: text("question_label").notNull(),
  value: text("value").notNull(),
});

export const insertRegistrationSchema = createInsertSchema(registrationsTable).omit({ id: true, createdAt: true });
export const insertAnswerSchema = createInsertSchema(answersTable).omit({ id: true });
export type InsertRegistration = z.infer<typeof insertRegistrationSchema>;
export type Registration = typeof registrationsTable.$inferSelect;
export type InsertAnswer = z.infer<typeof insertAnswerSchema>;
export type Answer = typeof answersTable.$inferSelect;
