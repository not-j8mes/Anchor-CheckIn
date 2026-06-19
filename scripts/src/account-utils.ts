import { and, eq, isNull } from "drizzle-orm";
import {
  answersTable,
  checkinsTable,
  db,
  emergencyContactsTable,
  eventCategoriesTable,
  eventsTable,
  eventSessionsTable,
  familyEventCodesTable,
  formFieldsTable,
  formsTable,
  formVersionFieldsTable,
  formVersionsTable,
  guardiansTable,
  organizationMembersTable,
  organizationsTable,
  participantGuardiansTable,
  participantsTable,
  questionsTable,
  registrationCustomAnswersTable,
  registrationGroupsTable,
  registrationsTable,
  roomsTable,
  usersTable,
} from "@workspace/db";
import { hashPassword } from "./passwords";

export const ALLOWED_ROLES = ["owner", "admin", "staff"] as const;
export type Role = (typeof ALLOWED_ROLES)[number];

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function optionalEnv(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findOrganizationByName(name: string) {
  const [org] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.name, name))
    .limit(1);
  return org ?? null;
}

export async function findOrCreateOrganization(input: {
  name: string;
  plan?: string;
  subscriptionStatus?: string;
}) {
  const existing = await findOrganizationByName(input.name);
  if (existing) return { organization: existing, created: false };

  const [organization] = await db
    .insert(organizationsTable)
    .values({
      name: input.name,
      plan: input.plan || "basic",
      subscriptionStatus: input.subscriptionStatus || "trialing",
    })
    .returning();

  return { organization, created: true };
}

export async function findOrCreateUser(input: {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}) {
  const email = normalizeEmail(input.email);
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing) return { user: existing, created: false };

  const [user] = await db
    .insert(usersTable)
    .values({
      email,
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash: hashPassword(input.password),
    })
    .returning();

  return { user, created: true };
}

export async function ensureMembership(input: {
  userId: number;
  organizationId: number;
  role: Role;
}) {
  const [existing] = await db
    .select()
    .from(organizationMembersTable)
    .where(
      and(
        eq(organizationMembersTable.userId, input.userId),
        eq(organizationMembersTable.organizationId, input.organizationId),
      ),
    )
    .limit(1);
  if (existing) return { membership: existing, created: false };

  const [membership] = await db
    .insert(organizationMembersTable)
    .values(input)
    .returning();

  return { membership, created: true };
}

export async function backfillExistingData(organizationId: number): Promise<void> {
  await db.update(formsTable).set({ organizationId }).where(isNull(formsTable.organizationId));
  await db.update(questionsTable).set({ organizationId }).where(isNull(questionsTable.organizationId));
  await db.update(formFieldsTable).set({ organizationId }).where(isNull(formFieldsTable.organizationId));
  await db.update(formVersionsTable).set({ organizationId }).where(isNull(formVersionsTable.organizationId));
  await db.update(formVersionFieldsTable).set({ organizationId }).where(isNull(formVersionFieldsTable.organizationId));
  await db.update(eventsTable).set({ organizationId }).where(isNull(eventsTable.organizationId));
  await db.update(eventSessionsTable).set({ organizationId }).where(isNull(eventSessionsTable.organizationId));
  await db.update(roomsTable).set({ organizationId }).where(isNull(roomsTable.organizationId));
  await db.update(registrationGroupsTable).set({ organizationId }).where(isNull(registrationGroupsTable.organizationId));
  await db.update(registrationsTable).set({ organizationId }).where(isNull(registrationsTable.organizationId));
  await db.update(registrationCustomAnswersTable).set({ organizationId }).where(isNull(registrationCustomAnswersTable.organizationId));
  await db.update(answersTable).set({ organizationId }).where(isNull(answersTable.organizationId));
  await db.update(participantsTable).set({ organizationId }).where(isNull(participantsTable.organizationId));
  await db.update(guardiansTable).set({ organizationId }).where(isNull(guardiansTable.organizationId));
  await db.update(participantGuardiansTable).set({ organizationId }).where(isNull(participantGuardiansTable.organizationId));
  await db.update(emergencyContactsTable).set({ organizationId }).where(isNull(emergencyContactsTable.organizationId));
  await db.update(checkinsTable).set({ organizationId }).where(isNull(checkinsTable.organizationId));
  await db.update(familyEventCodesTable).set({ organizationId }).where(isNull(familyEventCodesTable.organizationId));
  await db.update(eventCategoriesTable).set({ organizationId }).where(isNull(eventCategoriesTable.organizationId));
}
