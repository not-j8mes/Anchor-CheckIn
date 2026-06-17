import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { formsTable } from "./forms";
import { eventsTable } from "./events";
import { participantsTable, guardiansTable } from "./participants";
import { formFieldsTable } from "./form_fields";
import { formVersionsTable } from "./form_versions";

/**
 * registration_groups — a single submission that covers multiple people.
 * Used for family/group registration types.
 */
export const registrationGroupsTable = pgTable("registration_groups", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => eventsTable.id, { onDelete: "set null" }),
  formId: integer("form_id").references(() => formsTable.id, { onDelete: "cascade" }),
  /** ID of the registration record that is the primary registrant (no FK to avoid circular dep). */
  primaryRegistrantId: integer("primary_registrant_id"),
  groupName: text("group_name"),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

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
  registrationGroupId: integer("registration_group_id").references(
    () => registrationGroupsTable.id,
    { onDelete: "set null" }
  ),
  formVersionId: integer("form_version_id").references(() => formVersionsTable.id, {
    onDelete: "set null",
  }),
  // Legacy flat columns — kept for backward compatibility
  childFirstName: text("child_first_name").notNull(),
  childLastName: text("child_last_name").notNull(),
  childDateOfBirth: text("child_date_of_birth"),
  guardianName: text("guardian_name").notNull(),
  guardianPhone: text("guardian_phone").notNull(),
  guardianEmail: text("guardian_email"),
  secondaryGuardianFirstName: text("secondary_guardian_first_name"),
  secondaryGuardianLastName: text("secondary_guardian_last_name"),
  secondaryGuardianPhone: text("secondary_guardian_phone"),
  secondaryGuardianEmail: text("secondary_guardian_email"),
  secondaryGuardianRelationship: text("secondary_guardian_relationship"),
  allergies: text("allergies"),
  medicalNotes: text("medical_notes"),
  specialNeeds: text("special_needs"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  emergencyContactRelationship: text("emergency_contact_relationship"),
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
export const insertRegistrationGroupSchema = createInsertSchema(registrationGroupsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRegistration = z.infer<typeof insertRegistrationSchema>;
export type Registration = typeof registrationsTable.$inferSelect;
export type InsertAnswer = z.infer<typeof insertAnswerSchema>;
export type Answer = typeof answersTable.$inferSelect;
export type RegistrationCustomAnswer = typeof registrationCustomAnswersTable.$inferSelect;
export type RegistrationGroup = typeof registrationGroupsTable.$inferSelect;
export type InsertRegistrationGroup = z.infer<typeof insertRegistrationGroupSchema>;
