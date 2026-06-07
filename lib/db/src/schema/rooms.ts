import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const roomsTable = pgTable("rooms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  capacity: integer("capacity"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Room = typeof roomsTable.$inferSelect;
export type NewRoom = typeof roomsTable.$inferInsert;
