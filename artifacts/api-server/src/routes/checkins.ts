import { Router } from "express";
import { eq, gte, desc, and, inArray, isNull, isNotNull } from "drizzle-orm";
import {
  db,
  checkinsTable,
  registrationsTable,
  registrationGroupsTable,
  familyEventCodesTable,
  formsTable,
  eventsTable,
  participantsTable,
  guardiansTable,
  participantGuardiansTable,
} from "@workspace/db";
import { CreateCheckinBody, CheckoutChildParams } from "@workspace/api-zod";
import { randomBytes } from "crypto";
import { isPgUniqueViolation } from "../lib/httpGuards";
import { requireAuthContext } from "../lib/auth";

const router = Router();

function generateLabelCode(): string {
  // Excludes easily confused characters: 0/O, 1/I
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(4);
  let code = "";
  for (const byte of bytes) {
    code += chars[byte % chars.length];
  }
  return code;
}

/**
 * When "Keep family pickup code the same" is enabled, return the existing family code
 * for this (event, registrationGroup) pair, creating one if none exists yet.
 * Returns null when the registration has no group or event to key on.
 */
function sessionCondition(sessionId: number | null | undefined) {
  return sessionId == null ? isNull(checkinsTable.sessionId) : eq(checkinsTable.sessionId, sessionId);
}

async function getFamilyLabelCode(
  organizationId: number,
  eventId: number | null | undefined,
  registrationGroupId: number | null | undefined,
  sessionId: number | null | undefined
): Promise<string | null> {
  if (!eventId || !registrationGroupId) return null;
  const [existing] = await db
    .select({ labelCode: familyEventCodesTable.labelCode })
    .from(familyEventCodesTable)
    .where(
      and(
        eq(familyEventCodesTable.eventId, eventId),
        eq(familyEventCodesTable.organizationId, organizationId),
        sessionId == null ? isNull(familyEventCodesTable.sessionId) : eq(familyEventCodesTable.sessionId, sessionId),
        eq(familyEventCodesTable.registrationGroupId, registrationGroupId)
      )
    )
    .limit(1);
  if (existing) return existing.labelCode;
  const newCode = generateLabelCode();
  await db
    .insert(familyEventCodesTable)
    .values({ organizationId, eventId, sessionId: sessionId ?? null, registrationGroupId, labelCode: newCode })
    .onConflictDoNothing();
  // Re-fetch in case a concurrent insert won the race
  const [row] = await db
    .select({ labelCode: familyEventCodesTable.labelCode })
    .from(familyEventCodesTable)
    .where(
      and(
        eq(familyEventCodesTable.eventId, eventId),
        eq(familyEventCodesTable.organizationId, organizationId),
        sessionId == null ? isNull(familyEventCodesTable.sessionId) : eq(familyEventCodesTable.sessionId, sessionId),
        eq(familyEventCodesTable.registrationGroupId, registrationGroupId)
      )
    )
    .limit(1);
  return row?.labelCode ?? newCode;
}

function serializeCheckin(c: typeof checkinsTable.$inferSelect) {
  return {
    ...c,
    childId: c.registrationId,
    checkinAt: c.checkinAt.toISOString(),
    checkoutAt: c.checkoutAt?.toISOString() ?? null,
  };
}

async function findActiveCheckin(
  registrationId: number,
  sessionId: number | null | undefined,
) {
  const [activeCheckin] = await db
    .select({ id: checkinsTable.id })
    .from(checkinsTable)
    .where(
      and(
        eq(checkinsTable.registrationId, registrationId),
        sessionCondition(sessionId),
        isNull(checkinsTable.checkoutAt),
      ),
    )
    .limit(1);
  return activeCheckin;
}

// Walk-in: register a new child and immediately check them in
router.post("/checkins/walkin", async (req, res) => {
  const { eventId, childFirstName, childLastName, guardianName, guardianPhone, sessionId, registrationGroupId: incomingGroupId } = req.body as Record<string, unknown>;
  if (
    typeof eventId !== "number" ||
    typeof childFirstName !== "string" || !childFirstName.trim() ||
    typeof childLastName !== "string" || !childLastName.trim() ||
    typeof guardianName !== "string" || !guardianName.trim() ||
    typeof guardianPhone !== "string" || !guardianPhone.trim()
  ) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  try {
    const auth = requireAuthContext(req);
    const [event] = await db
      .select()
      .from(eventsTable)
      .where(and(eq(eventsTable.id, eventId), eq(eventsTable.organizationId, auth.organizationId)))
      .limit(1);
    if (!event?.formId) {
      res.status(404).json({ error: "Event not found or has no registration form" });
      return;
    }

    const nameParts = guardianName.trim().split(/\s+/);
    const gFirst = nameParts[0] ?? guardianName;
    const gLast = nameParts.slice(1).join(" ") || "";

    const [participant] = await db
      .insert(participantsTable)
      .values({ organizationId: auth.organizationId, firstName: childFirstName, lastName: childLastName })
      .returning();

    const [guardian] = await db
      .insert(guardiansTable)
      .values({ organizationId: auth.organizationId, firstName: gFirst, lastName: gLast, phone: guardianPhone })
      .returning();

    await db.insert(participantGuardiansTable).values({
      organizationId: auth.organizationId,
      participantId: participant.id,
      guardianId: guardian.id,
      isPrimary: true,
      canPickUp: true,
    });

    // Resolve group ID:
    // 1. Caller passed one (multi-child walk-in — already created a shared group)
    // 2. Look for existing group in this event with the same guardian phone
    // 3. Create a new group
    let registrationGroupId: number;
    if (typeof incomingGroupId === "number") {
      registrationGroupId = incomingGroupId;
    } else {
      const phone = typeof guardianPhone === "string" ? guardianPhone.trim() : null;
      let foundGroupId: number | null = null;

      if (phone) {
        const [existing] = await db
          .select({ groupId: registrationsTable.registrationGroupId })
          .from(registrationsTable)
          .where(
            and(
              eq(registrationsTable.eventId, eventId),
              eq(registrationsTable.organizationId, auth.organizationId),
              eq(registrationsTable.guardianPhone, phone),
              isNotNull(registrationsTable.registrationGroupId)
            )
          )
          .limit(1);
        foundGroupId = existing?.groupId ?? null;
      }

      if (foundGroupId) {
        registrationGroupId = foundGroupId;
      } else {
        const [newGroup] = await db
          .insert(registrationGroupsTable)
          .values({ organizationId: auth.organizationId, eventId, formId: event.formId, submittedAt: new Date() })
          .returning();
        registrationGroupId = newGroup.id;
      }
    }

    const [registration] = await db
      .insert(registrationsTable)
      .values({
        formId: event.formId,
        organizationId: auth.organizationId,
        eventId,
        participantId: participant.id,
        guardianId: guardian.id,
        registrationGroupId,
        submittedAt: new Date(),
        childFirstName,
        childLastName,
        guardianName,
        guardianPhone,
      })
      .returning();

    const labelCode = generateLabelCode();
    const orgName = auth.organization.name;

    const [checkin] = await db
      .insert(checkinsTable)
      .values({
        registrationId: registration.id,
        organizationId: auth.organizationId,
        sessionId: typeof sessionId === "number" ? sessionId : null,
        childFirstName,
        childLastName,
        guardianName,
        labelCode,
        labelPrinted: false,
      })
      .returning();

    res.status(201).json({
      checkin: serializeCheckin(checkin),
      registrationGroupId,
      labelData: {
        childName: `${childFirstName} ${childLastName}`,
        guardianName,
        labelCode,
        checkinDate: checkin.checkinAt.toISOString(),
        room: null,
        allergies: null,
        specialNeeds: null,
        organizationName: orgName,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to walk-in check-in");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Bulk checkout — must be registered BEFORE /checkins/:checkinId routes
router.post("/checkins/bulk-checkout", async (req, res) => {
  const { eventId, sessionId, reason, note, checkoutAt } = (req.body ?? {}) as {
    eventId?: number; sessionId?: number; reason?: string; note?: string; checkoutAt?: string;
  };
  if (!eventId || !reason) {
    res.status(400).json({ error: "eventId and reason are required" });
    return;
  }
  try {
    const auth = requireAuthContext(req);
    const [event] = await db
      .select()
      .from(eventsTable)
      .where(and(eq(eventsTable.id, eventId), eq(eventsTable.organizationId, auth.organizationId)))
      .limit(1);
    if (!event) { res.status(404).json({ error: "Event not found" }); return; }

    const regs = await db
      .select({ id: registrationsTable.id })
      .from(registrationsTable)
      .where(and(eq(registrationsTable.eventId, eventId), eq(registrationsTable.organizationId, auth.organizationId)));
    if (regs.length === 0) { res.json({ count: 0, checkins: [] }); return; }

    const regIds = regs.map((r) => r.id);
    const active = await db
      .select({ id: checkinsTable.id })
      .from(checkinsTable)
      .where(and(
        inArray(checkinsTable.registrationId, regIds),
        eq(checkinsTable.organizationId, auth.organizationId),
        sessionId == null ? undefined : eq(checkinsTable.sessionId, sessionId),
        isNull(checkinsTable.checkoutAt)
      ));

    if (active.length === 0) { res.json({ count: 0, checkins: [] }); return; }

    const now = checkoutAt ? new Date(checkoutAt) : new Date();
    const updated = await db
      .update(checkinsTable)
      .set({
        checkoutAt: now,
        checkoutMethod: "bulk_admin",
        checkoutReason: reason,
        notes: note?.trim() || null,
        updatedAt: new Date(),
      })
      .where(and(inArray(checkinsTable.id, active.map((c) => c.id)), eq(checkinsTable.organizationId, auth.organizationId)))
      .returning();

    res.json({ count: updated.length, checkins: updated.map(serializeCheckin) });
  } catch (err) {
    req.log.error({ err }, "Failed bulk checkout");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Batch check-in — must be registered BEFORE /checkins/:checkinId routes
router.post("/checkins/batch", async (req, res) => {
  const { items, sessionId, reuseFamilyCode } = req.body as { items: Array<{ registrationId: number; room?: string }>; sessionId?: number; reuseFamilyCode?: boolean };
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "items array is required" });
    return;
  }
  try {
    const auth = requireAuthContext(req);
    // Resolve the shared label code: look up or create a family code if reuseFamilyCode is on,
    // otherwise generate a fresh shared code for this batch session.
    let sharedLabelCode: string;
    if (reuseFamilyCode && items[0]) {
      const firstReg = await db
        .select({ eventId: registrationsTable.eventId, registrationGroupId: registrationsTable.registrationGroupId })
        .from(registrationsTable)
        .where(and(eq(registrationsTable.id, items[0].registrationId), eq(registrationsTable.organizationId, auth.organizationId)))
        .limit(1);
      sharedLabelCode =
        (await getFamilyLabelCode(auth.organizationId, firstReg[0]?.eventId, firstReg[0]?.registrationGroupId, sessionId)) ??
        generateLabelCode();
    } else {
      sharedLabelCode = generateLabelCode();
    }
    const orgName = auth.organization.name;

    const checkins: ReturnType<typeof serializeCheckin>[] = [];
    const labels: object[] = [];
    const skipped: { registrationId: number; reason: string; checkinId?: number }[] = [];

    for (const item of items) {
      const reg = await db
        .select()
        .from(registrationsTable)
        .where(and(eq(registrationsTable.id, item.registrationId), eq(registrationsTable.organizationId, auth.organizationId)))
        .limit(1);
      if (!reg[0]) continue;
      const r = reg[0];

      const activeCheckin = await findActiveCheckin(item.registrationId, sessionId);
      if (activeCheckin) {
        skipped.push({ registrationId: item.registrationId, reason: "Already checked in", checkinId: activeCheckin.id });
        continue;
      }

      let checkin: typeof checkinsTable.$inferSelect;
      try {
        [checkin] = await db
          .insert(checkinsTable)
          .values({
            registrationId: item.registrationId,
            organizationId: auth.organizationId,
            sessionId: sessionId ?? null,
            childFirstName: r.childFirstName,
            childLastName: r.childLastName,
            guardianName: r.guardianName,
            room: item.room ?? r.room ?? null,
            labelCode: sharedLabelCode,
            labelPrinted: false,
          })
          .returning();
      } catch (err) {
        if (isPgUniqueViolation(err)) {
          const concurrentActiveCheckin = await findActiveCheckin(item.registrationId, sessionId);
          skipped.push({
            registrationId: item.registrationId,
            reason: "Already checked in",
            checkinId: concurrentActiveCheckin?.id,
          });
          continue;
        }
        throw err;
      }

      checkins.push(serializeCheckin(checkin));
      labels.push({
        childName: `${r.childFirstName} ${r.childLastName}`,
        guardianName: r.guardianName,
        labelCode: sharedLabelCode,
        checkinDate: checkin.checkinAt.toISOString(),
        room: checkin.room,
        allergies: r.allergies,
        specialNeeds: r.specialNeeds,
        organizationName: orgName,
      });
    }

    res.status(201).json({ checkins, labels, skipped });
  } catch (err) {
    req.log.error({ err }, "Failed to batch check-in");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/checkins", async (req, res) => {
  const dateStr = req.query.date as string | undefined;
  const formIdStr = req.query.formId as string | undefined;
  try {
    const auth = requireAuthContext(req);
    let checkins;

    if (formIdStr) {
      // Get all registrations for this form, then get their check-ins
      const formId = parseInt(formIdStr, 10);
      const regs = await db
        .select({ id: registrationsTable.id })
        .from(registrationsTable)
        .where(and(eq(registrationsTable.formId, formId), eq(registrationsTable.organizationId, auth.organizationId)));

      if (regs.length === 0) {
        res.json([]);
        return;
      }
      const regIds = regs.map((r) => r.id);
      checkins = await db
        .select()
        .from(checkinsTable)
        .where(and(inArray(checkinsTable.registrationId, regIds), eq(checkinsTable.organizationId, auth.organizationId)))
        .orderBy(desc(checkinsTable.checkinAt));
    } else if (dateStr) {
      const date = new Date(dateStr);
      checkins = await db
        .select()
        .from(checkinsTable)
        .where(and(gte(checkinsTable.checkinAt, date), eq(checkinsTable.organizationId, auth.organizationId)))
        .orderBy(desc(checkinsTable.checkinAt));
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      checkins = await db
        .select()
        .from(checkinsTable)
        .where(and(gte(checkinsTable.checkinAt, today), eq(checkinsTable.organizationId, auth.organizationId)))
        .orderBy(desc(checkinsTable.checkinAt));
    }

    res.json(checkins.map(serializeCheckin));
  } catch (err) {
    req.log.error({ err }, "Failed to list checkins");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/checkins", async (req, res) => {
  const parsed = CreateCheckinBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  try {
    const { registrationId, room, sessionId, reuseFamilyCode } = parsed.data;
    const auth = requireAuthContext(req);

    const reg = await db
      .select()
      .from(registrationsTable)
      .where(and(eq(registrationsTable.id, registrationId), eq(registrationsTable.organizationId, auth.organizationId)))
      .limit(1);
    if (!reg[0]) {
      res.status(404).json({ error: "Registration not found" });
      return;
    }
    // Prevent duplicate active check-ins for the same registration
    const activeCheckin = await findActiveCheckin(registrationId, sessionId);
    if (activeCheckin) {
      res.status(409).json({ error: "Already checked in", checkinId: activeCheckin.id });
      return;
    }
    const r = reg[0];
    const labelCode = reuseFamilyCode
      ? (await getFamilyLabelCode(auth.organizationId, r.eventId, r.registrationGroupId, sessionId)) ?? generateLabelCode()
      : generateLabelCode();
    let checkin: typeof checkinsTable.$inferSelect;
    try {
      [checkin] = await db
        .insert(checkinsTable)
        .values({
          registrationId,
          organizationId: auth.organizationId,
          sessionId: sessionId ?? null,
          childFirstName: r.childFirstName,
          childLastName: r.childLastName,
          guardianName: r.guardianName,
          room: room ?? r.room ?? null,
          labelCode,
          labelPrinted: false,
        })
        .returning();
    } catch (err) {
      if (isPgUniqueViolation(err)) {
        const concurrentActiveCheckin = await findActiveCheckin(registrationId, sessionId);
        res.status(409).json({
          error: "Already checked in",
          checkinId: concurrentActiveCheckin?.id,
        });
        return;
      }
      throw err;
    }

    const orgName = auth.organization.name;

    const labelData = {
      childName: `${r.childFirstName} ${r.childLastName}`,
      guardianName: r.guardianName,
      labelCode,
      checkinDate: checkin.checkinAt.toISOString(),
      room: checkin.room,
      allergies: r.allergies,
      specialNeeds: r.specialNeeds,
      organizationName: orgName,
    };

    res.status(201).json({ checkin: serializeCheckin(checkin), labelData });
  } catch (err) {
    req.log.error({ err }, "Failed to create checkin");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/checkins/:checkinId", async (req, res) => {
  const checkinId = parseInt(req.params.checkinId, 10);
  if (isNaN(checkinId)) { res.status(400).json({ error: "Invalid checkinId" }); return; }
  try {
    const auth = requireAuthContext(req);
    await db.delete(checkinsTable).where(and(eq(checkinsTable.id, checkinId), eq(checkinsTable.organizationId, auth.organizationId)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete checkin");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/checkins/:checkinId", async (req, res) => {
  const checkinId = parseInt(req.params.checkinId, 10);
  if (isNaN(checkinId)) { res.status(400).json({ error: "Invalid checkinId" }); return; }
  const { notes } = (req.body ?? {}) as { notes?: string };
  try {
    const auth = requireAuthContext(req);
    const [updated] = await db
      .update(checkinsTable)
      .set({ notes: notes !== undefined ? (notes.trim() || null) : undefined, updatedAt: new Date() })
      .where(and(eq(checkinsTable.id, checkinId), eq(checkinsTable.organizationId, auth.organizationId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(serializeCheckin(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update checkin");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/checkins/:checkinId/undo-checkout", async (req, res) => {
  const checkinId = parseInt(req.params.checkinId, 10);
  if (isNaN(checkinId)) { res.status(400).json({ error: "Invalid checkinId" }); return; }
  try {
    const auth = requireAuthContext(req);
    const [updated] = await db
      .update(checkinsTable)
      .set({ checkoutAt: null, pickupPersonName: null, updatedAt: new Date() })
      .where(and(eq(checkinsTable.id, checkinId), eq(checkinsTable.organizationId, auth.organizationId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(serializeCheckin(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to undo checkout");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/checkins/:checkinId/checkout", async (req, res) => {
  const { checkinId: checkinIdStr } = CheckoutChildParams.parse(req.params);
  const checkinId = Number(checkinIdStr);
  const { pickupPersonName, notes } = (req.body ?? {}) as { pickupPersonName?: string; notes?: string };
  try {
    const auth = requireAuthContext(req);
    const [updated] = await db
      .update(checkinsTable)
      .set({
        checkoutAt: new Date(),
        updatedAt: new Date(),
        pickupPersonName: pickupPersonName?.trim() || null,
        notes: notes?.trim() || null,
      })
      .where(and(eq(checkinsTable.id, checkinId), eq(checkinsTable.organizationId, auth.organizationId)))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(serializeCheckin(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to checkout");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
