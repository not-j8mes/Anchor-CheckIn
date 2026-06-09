import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { formsTable } from "./forms";

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  eventType: text("event_type").notNull().default("general"),
  registrationType: text("registration_type"),
  startDate: text("start_date"),
  endDate: text("end_date"),
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
