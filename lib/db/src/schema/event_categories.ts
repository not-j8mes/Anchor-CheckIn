import { integer, pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";

export const eventCategoriesTable = pgTable("event_categories", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizationsTable.id, {
    onDelete: "cascade",
  }),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
