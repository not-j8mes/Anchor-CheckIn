import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { formsTable } from "./forms";
import { eventsTable } from "./events";
import { participantsTable, guardiansTable } from "./participants";
import { formFieldsTable } from "./form_fields";

export const registrationsTable = pgTable("registrations", {
  id: serial("id").primaryKey(),
  formId: integer("form_id")
    .notNull()
    .references(() => formsTable.id, { onDelete: "cascade" }),
  // New architecture FKs — nullable so existing records stay valid
  eventId: integer("event_id").references(() => eventsTable.id, { onDelete: "set null" }),
  participantId: integer("participant_id").references(() => participantsTable.id, {
    onDelete: "set null",
  }),
  guardianId: integer("guardian_id").references(() => guardiansTable.id, {
    onDelete: "set null",
  }),
  // Legacy flat columns — kept for backward compatibility
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
  submittedAt: timestamp("submitted_at"),
});

/**
 * registration_custom_answers — stores answers to custom (non-system) form fields.
 * Replaces/supplements the legacy answers table for the new architecture.
 */
export const registrationCustomAnswersTable = pgTable("registration_custom_answers", {
  id: serial("id").primaryKey(),
  registrationId: integer("registration_id")
    .notNull()
    .references(() => registrationsTable.id, { onDelete: "cascade" }),
  formFieldId: integer("form_field_id").references(() => formFieldsTable.id, {
    onDelete: "set null",
  }),
  questionLabel: text("question_label").notNull(),
  answerValue: text("answer_value").notNull(),
});

export const answersTable = pgTable("answers", {
  id: serial("id").primaryKey(),
  registrationId: integer("registration_id")
    .notNull()
    .references(() => registrationsTable.id, { onDelete: "cascade" }),
  questionId: integer("question_id").notNull(),
  questionLabel: text("question_label").notNull(),
  value: text("value").notNull(),
});

export const insertRegistrationSchema = createInsertSchema(registrationsTable).omit({
  id: true,
  createdAt: true,
});
export const insertAnswerSchema = createInsertSchema(answersTable).omit({ id: true });
export const insertRegistrationCustomAnswerSchema = createInsertSchema(
  registrationCustomAnswersTable
).omit({ id: true });

export type InsertRegistration = z.infer<typeof insertRegistrationSchema>;
export type Registration = typeof registrationsTable.$inferSelect;
export type InsertAnswer = z.infer<typeof insertAnswerSchema>;
export type Answer = typeof answersTable.$inferSelect;
export type RegistrationCustomAnswer = typeof registrationCustomAnswersTable.$inferSelect;
