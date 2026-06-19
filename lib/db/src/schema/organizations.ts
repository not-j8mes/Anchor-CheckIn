import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const DEFAULT_ORGANIZATION_NAME =
  "Anchor Events - Check In and Registration";
export const DEFAULT_PLAN = "basic";
export const DEFAULT_SUBSCRIPTION_STATUS = "trialing";

export const organizationsTable = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().default(DEFAULT_ORGANIZATION_NAME),
  logoUrl: text("logo_url"),
  headerText: text("header_text"),
  address: text("address"),
  phone: text("phone"),
  website: text("website"),
  subscriptionStatus: text("subscription_status")
    .notNull()
    .default(DEFAULT_SUBSCRIPTION_STATUS),
  plan: text("plan").notNull().default(DEFAULT_PLAN),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  printerIp: text("printer_ip"),
  printerName: text("printer_name"),
  printingMode: text("printing_mode").notNull().default("manual"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const usersTable = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    isSuperAdmin: boolean("is_super_admin").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const organizationMembersTable = pgTable(
  "organization_members",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("staff"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("organization_members_user_org_unique").on(
      table.userId,
      table.organizationId,
    ),
  ],
);

export const insertOrganizationSchema = createInsertSchema(
  organizationsTable,
).omit({ id: true });
export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertOrganizationMemberSchema = createInsertSchema(
  organizationMembersTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizationsTable.$inferSelect;
export type User = typeof usersTable.$inferSelect;
export type OrganizationMember = typeof organizationMembersTable.$inferSelect;
