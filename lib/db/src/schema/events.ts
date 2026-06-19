import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { formsTable } from "./forms";
import { organizationsTable } from "./organizations";

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizationsTable.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  description: text("description"),
  eventType: text("event_type").notNull().default("general"),
  registrationType: text("registration_type"),
  scheduleType: text("schedule_type").notNull().default("one_time"), // 'one_time' | 'multi_day' | 'repeating'
  startDate: text("start_date"),
  endDate: text("end_date"),
  startTime: text("start_time"),
  endTime: text("end_time"),
  repeatFrequency: text("repeat_frequency"), // 'weekly'
  repeatDayOfWeek: integer("repeat_day_of_week"), // 0=Sun, 1=Mon, ..., 6=Sat
  status: text("status").notNull().default("upcoming"),
  formId: integer("form_id").references(() => formsTable.id, { onDelete: "set null" }),
  // Check-in / attendance settings — null means derive from registrationType on the client
  trackAttendance: boolean("track_attendance"),
  requireCheckout: boolean("require_checkout"),
  printLabels: boolean("print_labels"),
  labelType: text("label_type"), // 'simple_name' | 'child_security'
  roomAssignmentMode: text("room_assignment_mode"), // 'manual' | 'registrant_chooses' | 'auto_assign'
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEventSchema = createInsertSchema(eventsTable).omit({ id: true, createdAt: true });
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;
