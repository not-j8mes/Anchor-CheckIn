import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { eventsTable } from "./events";

export const roomsTable = pgTable("rooms", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  capacity: integer("capacity"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  // Auto-assign rule: age range in years (inclusive)
  ageMin: integer("age_min"),
  ageMax: integer("age_max"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Room = typeof roomsTable.$inferSelect;
export type NewRoom = typeof roomsTable.$inferInsert;
