import { sql } from "drizzle-orm";
import { pgTable, serial, text, boolean, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { registrationsTable, registrationGroupsTable } from "./registrations";
import { eventSessionsTable } from "./event_sessions";
import { eventsTable } from "./events";
import { organizationsTable } from "./organizations";

export const checkinsTable = pgTable(
  "checkins",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").references(() => organizationsTable.id, {
      onDelete: "cascade",
    }),
    registrationId: integer("registration_id").notNull().references(() => registrationsTable.id, { onDelete: "cascade" }),
    sessionId: integer("session_id").references(() => eventSessionsTable.id, { onDelete: "set null" }),
    childFirstName: text("child_first_name").notNull(),
    childLastName: text("child_last_name").notNull(),
    guardianName: text("guardian_name").notNull(),
    checkinAt: timestamp("checkin_at").notNull().defaultNow(),
    checkoutAt: timestamp("checkout_at"),
    room: text("room"),
    labelCode: text("label_code").notNull(),
    labelPrinted: boolean("label_printed").notNull().default(false),
    pickupPersonName: text("pickup_person_name"),
    notes: text("notes"),
    checkoutMethod: text("checkout_method"),
    checkoutReason: text("checkout_reason"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("checkins_active_registration_session_unique")
      .on(t.registrationId, t.sessionId)
      .where(sql`${t.checkoutAt} IS NULL AND ${t.sessionId} IS NOT NULL`),
    uniqueIndex("checkins_active_registration_no_session_unique")
      .on(t.registrationId)
      .where(sql`${t.checkoutAt} IS NULL AND ${t.sessionId} IS NULL`),
  ],
);

export const insertCheckinSchema = createInsertSchema(checkinsTable).omit({ id: true, checkinAt: true });
export type InsertCheckin = z.infer<typeof insertCheckinSchema>;
export type Checkin = typeof checkinsTable.$inferSelect;

/**
 * Stores a persistent family pickup/security code for a (event, registration_group) pair.
 * Used when "Keep family pickup code the same" is enabled on the Check-In Desk so that
 * late-arriving siblings receive the same code as earlier check-ins.
 */
export const familyEventCodesTable = pgTable(
  "family_event_codes",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").references(() => organizationsTable.id, {
      onDelete: "cascade",
    }),
    eventId: integer("event_id")
      .notNull()
      .references(() => eventsTable.id, { onDelete: "cascade" }),
    sessionId: integer("session_id").references(() => eventSessionsTable.id, {
      onDelete: "cascade",
    }),
    registrationGroupId: integer("registration_group_id")
      .notNull()
      .references(() => registrationGroupsTable.id, { onDelete: "cascade" }),
    labelCode: text("label_code").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("fec_event_session_group_unique").on(t.eventId, t.sessionId, t.registrationGroupId),
  ]
);
