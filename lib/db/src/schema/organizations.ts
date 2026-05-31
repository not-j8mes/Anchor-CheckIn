import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const organizationsTable = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().default("My Church"),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").notNull().default("#1e3a5f"),
  headerText: text("header_text"),
  address: text("address"),
  phone: text("phone"),
  website: text("website"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertOrganizationSchema = createInsertSchema(organizationsTable).omit({ id: true });
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizationsTable.$inferSelect;
