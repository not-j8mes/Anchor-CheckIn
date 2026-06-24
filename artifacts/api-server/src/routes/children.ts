import { Router } from "express";
import { and, eq, desc } from "drizzle-orm";
import {
  db,
  registrationsTable,
  checkinsTable,
  guardiansTable,
  participantGuardiansTable,
  emergencyContactsTable,
} from "@workspace/db";
import { GetChildParams } from "@workspace/api-zod";
import { requireAuthContext } from "../lib/auth";

const router = Router();

async function buildChild(reg: typeof registrationsTable.$inferSelect) {
  const lastCheckin = await db
    .select()
    .from(checkinsTable)
    .where(eq(checkinsTable.registrationId, reg.id))
    .orderBy(desc(checkinsTable.checkinAt))
    .limit(1);

  const activeCheckin = await db
    .select()
    .from(checkinsTable)
    .where(eq(checkinsTable.registrationId, reg.id))
    .orderBy(desc(checkinsTable.checkinAt))
    .limit(10);

  // Find a checkin with no checkout (currently checked in)
  const active = activeCheckin.find((c) => c.checkoutAt === null) ?? null;

  const guardianLinks = reg.participantId
    ? await db
        .select({
          isPrimary: participantGuardiansTable.isPrimary,
          relationship: participantGuardiansTable.relationship,
          guardian: guardiansTable,
        })
        .from(participantGuardiansTable)
        .innerJoin(guardiansTable, eq(participantGuardiansTable.guardianId, guardiansTable.id))
        .where(eq(participantGuardiansTable.participantId, reg.participantId))
    : [];
  const primaryGuardianLink = guardianLinks.find((link) => link.isPrimary);
  const secondGuardianLink = guardianLinks.find((link) => !link.isPrimary);
  const emergencyContacts = reg.participantId
    ? await db
        .select()
        .from(emergencyContactsTable)
        .where(eq(emergencyContactsTable.participantId, reg.participantId))
        .limit(1)
    : [];
  const primaryGuardian = primaryGuardianLink
    ? {
        id: primaryGuardianLink.guardian.id,
        firstName: primaryGuardianLink.guardian.firstName,
        lastName: primaryGuardianLink.guardian.lastName,
        name: [primaryGuardianLink.guardian.firstName, primaryGuardianLink.guardian.lastName].filter(Boolean).join(" "),
        phone: primaryGuardianLink.guardian.phone,
        email: primaryGuardianLink.guardian.email,
        relationship: primaryGuardianLink.relationship,
      }
    : {
        id: reg.guardianId,
        firstName: reg.guardianName.split(/\s+/)[0] ?? "",
        lastName: reg.guardianName.split(/\s+/).slice(1).join(" "),
        name: reg.guardianName,
        phone: reg.guardianPhone,
        email: reg.guardianEmail,
        relationship: null,
      };
  const secondGuardian = secondGuardianLink
    ? {
        id: secondGuardianLink.guardian.id,
        firstName: secondGuardianLink.guardian.firstName,
        lastName: secondGuardianLink.guardian.lastName,
        name: [secondGuardianLink.guardian.firstName, secondGuardianLink.guardian.lastName].filter(Boolean).join(" "),
        phone: secondGuardianLink.guardian.phone,
        email: secondGuardianLink.guardian.email,
        relationship: secondGuardianLink.relationship,
      }
    : reg.secondaryGuardianFirstName ||
        reg.secondaryGuardianLastName ||
        reg.secondaryGuardianPhone ||
        reg.secondaryGuardianEmail ||
        reg.secondaryGuardianRelationship
      ? {
          id: null,
          firstName: reg.secondaryGuardianFirstName,
          lastName: reg.secondaryGuardianLastName,
          name: [reg.secondaryGuardianFirstName, reg.secondaryGuardianLastName].filter(Boolean).join(" "),
          phone: reg.secondaryGuardianPhone,
          email: reg.secondaryGuardianEmail,
          relationship: reg.secondaryGuardianRelationship,
        }
      : null;
  const emergencyContact = emergencyContacts[0]
    ? {
        id: emergencyContacts[0].id,
        name: emergencyContacts[0].name,
        phone: emergencyContacts[0].phone,
        relationship: emergencyContacts[0].relationship,
      }
    : reg.emergencyContactName || reg.emergencyContactPhone || reg.emergencyContactRelationship
      ? {
          id: null,
          name: reg.emergencyContactName,
          phone: reg.emergencyContactPhone,
          relationship: reg.emergencyContactRelationship,
        }
      : null;

  return {
    id: reg.id,
    firstName: reg.childFirstName,
    lastName: reg.childLastName,
    dateOfBirth: reg.childDateOfBirth,
    guardianName: reg.guardianName,
    guardianPhone: reg.guardianPhone,
    guardianEmail: reg.guardianEmail,
    primaryGuardian,
    secondGuardian,
    emergencyContact,
    secondaryGuardianFirstName: secondGuardian?.firstName ?? null,
    secondaryGuardianLastName: secondGuardian?.lastName ?? null,
    secondaryGuardianPhone: secondGuardian?.phone ?? null,
    secondaryGuardianEmail: secondGuardian?.email ?? null,
    secondaryGuardianRelationship: secondGuardian?.relationship ?? null,
    emergencyContactName: emergencyContact?.name ?? null,
    emergencyContactPhone: emergencyContact?.phone ?? null,
    emergencyContactRelationship: emergencyContact?.relationship ?? null,
    allergies: reg.allergies,
    medicalNotes: reg.medicalNotes,
    specialNeeds: reg.specialNeeds,
    room: reg.room,
    lastCheckinAt: lastCheckin[0]?.checkinAt?.toISOString() ?? null,
    registrationId: reg.id,
    isCheckedIn: active !== null,
    checkinId: active?.id ?? null,
    activeCheckinLabelCode: active?.labelCode ?? null,
    registrationGroupId: reg.registrationGroupId ?? null,
  };
}

router.get("/children", async (req, res) => {
  const search = req.query.search as string | undefined;
  const eventIdStr = req.query.eventId as string | undefined;
  const eventId = eventIdStr ? parseInt(eventIdStr, 10) : undefined;
  try {
    const auth = requireAuthContext(req);
    const regs = await db
      .select()
      .from(registrationsTable)
      .where(
        eventId !== undefined
          ? and(eq(registrationsTable.organizationId, auth.organizationId), eq(registrationsTable.eventId, eventId))
          : eq(registrationsTable.organizationId, auth.organizationId),
      )
      .orderBy(desc(registrationsTable.createdAt));

    const children = await Promise.all(regs.map(buildChild));

    if (search) {
      const lower = search.toLowerCase();
      const filtered = children.filter(
        (c) =>
          c.firstName.toLowerCase().includes(lower) ||
          c.lastName.toLowerCase().includes(lower) ||
          c.guardianName.toLowerCase().includes(lower) ||
          (c.guardianPhone && c.guardianPhone.replace(/\D/g, "").includes(lower.replace(/\D/g, ""))) ||
          (c.secondGuardian?.name && c.secondGuardian.name.toLowerCase().includes(lower)) ||
          (c.secondGuardian?.phone && c.secondGuardian.phone.replace(/\D/g, "").includes(lower.replace(/\D/g, ""))) ||
          (c.secondGuardian?.email && c.secondGuardian.email.toLowerCase().includes(lower)) ||
          (c.emergencyContact?.name && c.emergencyContact.name.toLowerCase().includes(lower)) ||
          (c.emergencyContact?.phone && c.emergencyContact.phone.replace(/\D/g, "").includes(lower.replace(/\D/g, "")))
      );
      res.json(filtered);
      return;
    }

    res.json(children);
  } catch (err) {
    req.log.error({ err }, "Failed to list children");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/children/:childId", async (req, res) => {
  const { childId: childIdStr } = GetChildParams.parse(req.params);
  const childId = Number(childIdStr);
  try {
    const auth = requireAuthContext(req);
    const reg = await db
      .select()
      .from(registrationsTable)
      .where(and(eq(registrationsTable.id, childId), eq(registrationsTable.organizationId, auth.organizationId)))
      .limit(1);
    if (!reg[0]) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(await buildChild(reg[0]));
  } catch (err) {
    req.log.error({ err }, "Failed to get child");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
