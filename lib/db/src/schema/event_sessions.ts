import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { eventsTable } from "./events";
import { organizationsTable } from "./organizations";

export const eventSessionsTable = pgTable("event_sessions", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizationsTable.id, {
    onDelete: "cascade",
  }),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  sessionDate: text("session_date").notNull(),
  startTime: text("start_time"),
  endTime: text("end_time"),
  status: text("status").notNull().default("scheduled"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEventSessionSchema = createInsertSchema(eventSessionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEventSession = z.infer<typeof insertEventSessionSchema>;
export type EventSession = typeof eventSessionsTable.$inferSelect;
