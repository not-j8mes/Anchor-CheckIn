import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const eventCategoriesTable = pgTable("event_categories", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull().unique(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
