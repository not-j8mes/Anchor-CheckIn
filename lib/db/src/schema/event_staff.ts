import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { eventsTable } from "./events";
import { organizationsTable } from "./organizations";

export const eventStaffRolesTable = pgTable(
  "event_staff_roles",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    eventId: integer("event_id")
      .notNull()
      .references(() => eventsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("event_staff_roles_event_name_unique").on(
      table.eventId,
      table.name,
    ),
  ],
);

export const eventStaffMembersTable = pgTable("event_staff_members", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  eventId: integer("event_id")
    .notNull()
    .references(() => eventsTable.id, { onDelete: "cascade" }),
  roleId: integer("role_id")
    .references(() => eventStaffRolesTable.id, { onDelete: "restrict" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type EventStaffRole = typeof eventStaffRolesTable.$inferSelect;
export type EventStaffMember = typeof eventStaffMembersTable.$inferSelect;
