import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const participantsTable = pgTable("participants", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizationsTable.id, {
    onDelete: "cascade",
  }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dateOfBirth: text("date_of_birth"),
  gender: text("gender"),
  grade: text("grade"),
  allergies: text("allergies"),
  medicalNotes: text("medical_notes"),
  specialNeeds: text("special_needs"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const guardiansTable = pgTable("guardians", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizationsTable.id, {
    onDelete: "cascade",
  }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const participantGuardiansTable = pgTable("participant_guardians", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizationsTable.id, {
    onDelete: "cascade",
  }),
  participantId: integer("participant_id")
    .notNull()
    .references(() => participantsTable.id, { onDelete: "cascade" }),
  guardianId: integer("guardian_id")
    .notNull()
    .references(() => guardiansTable.id, { onDelete: "cascade" }),
  relationship: text("relationship"),
  isPrimary: boolean("is_primary").notNull().default(false),
  canPickUp: boolean("can_pick_up").notNull().default(true),
});

export const emergencyContactsTable = pgTable("emergency_contacts", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizationsTable.id, {
    onDelete: "cascade",
  }),
  participantId: integer("participant_id")
    .notNull()
    .references(() => participantsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  relationship: text("relationship"),
});

export const insertParticipantSchema = createInsertSchema(participantsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertGuardianSchema = createInsertSchema(guardiansTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Participant = typeof participantsTable.$inferSelect;
export type InsertParticipant = z.infer<typeof insertParticipantSchema>;
export type Guardian = typeof guardiansTable.$inferSelect;
export type InsertGuardian = z.infer<typeof insertGuardianSchema>;
export type ParticipantGuardian = typeof participantGuardiansTable.$inferSelect;
export type EmergencyContact = typeof emergencyContactsTable.$inferSelect;
