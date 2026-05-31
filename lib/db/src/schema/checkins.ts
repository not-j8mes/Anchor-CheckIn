import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { registrationsTable } from "./registrations";

export const checkinsTable = pgTable("checkins", {
  id: serial("id").primaryKey(),
  registrationId: integer("registration_id").notNull().references(() => registrationsTable.id, { onDelete: "cascade" }),
  childFirstName: text("child_first_name").notNull(),
  childLastName: text("child_last_name").notNull(),
  guardianName: text("guardian_name").notNull(),
  checkinAt: timestamp("checkin_at").notNull().defaultNow(),
  checkoutAt: timestamp("checkout_at"),
  room: text("room"),
  labelCode: text("label_code").notNull(),
  labelPrinted: boolean("label_printed").notNull().default(false),
});

export const insertCheckinSchema = createInsertSchema(checkinsTable).omit({ id: true, checkinAt: true });
export type InsertCheckin = z.infer<typeof insertCheckinSchema>;
export type Checkin = typeof checkinsTable.$inferSelect;
