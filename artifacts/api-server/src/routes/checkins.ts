import { Router } from "express";
import { eq, gte, desc, and, inArray, isNull } from "drizzle-orm";
import {
  db,
  checkinsTable,
  registrationsTable,
  organizationsTable,
  formsTable,
  eventsTable,
  participantsTable,
  guardiansTable,
  participantGuardiansTable,
} from "@workspace/db";
import { CreateCheckinBody, CheckoutChildParams } from "@workspace/api-zod";
import { randomBytes } from "crypto";

const router = Router();

function generateLabelCode(): string {
  return randomBytes(3).toString("hex").toUpperCase();
}

function serializeCheckin(c: typeof checkinsTable.$inferSelect) {
  return {
    ...c,
    childId: c.registrationId,
    checkinAt: c.checkinAt.toISOString(),
    checkoutAt: c.checkoutAt?.toISOString() ?? null,
  };
}

// Walk-in: register a new child and immediately check them in
router.post("/checkins/walkin", async (req, res) => {
  const { eventId, childFirstName, childLastName, guardianName, guardianPhone } = req.body as Record<string, unknown>;
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
    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
    if (!event?.formId) {
      res.status(404).json({ error: "Event not found or has no registration form" });
      return;
    }

    const nameParts = guardianName.trim().split(/\s+/);
    const gFirst = nameParts[0] ?? guardianName;
    const gLast = nameParts.slice(1).join(" ") || "";

    const [participant] = await db
      .insert(participantsTable)
      .values({ firstName: childFirstName, lastName: childLastName })
      .returning();

    const [guardian] = await db
      .insert(guardiansTable)
      .values({ firstName: gFirst, lastName: gLast, phone: guardianPhone })
      .returning();

    await db.insert(participantGuardiansTable).values({
      participantId: participant.id,
      guardianId: guardian.id,
      isPrimary: true,
      canPickUp: true,
    });

    const [registration] = await db
      .insert(registrationsTable)
      .values({
        formId: event.formId,
        eventId,
        participantId: participant.id,
        guardianId: guardian.id,
        submittedAt: new Date(),
        childFirstName,
        childLastName,
        guardianName,
        guardianPhone,
      })
      .returning();

    const labelCode = generateLabelCode();
    const orgs = await db.select().from(organizationsTable).limit(1);
    const orgName = orgs[0]?.name ?? "Church";

    const [checkin] = await db
      .insert(checkinsTable)
      .values({
        registrationId: registration.id,
        childFirstName,
        childLastName,
        guardianName,
        labelCode,
        labelPrinted: false,
      })
      .returning();

    res.status(201).json({
      checkin: serializeCheckin(checkin),
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

// Batch check-in — must be registered BEFORE /checkins/:checkinId routes
router.post("/checkins/batch", async (req, res) => {
  const { items } = req.body as { items: Array<{ registrationId: number; room?: string }> };
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "items array is required" });
    return;
  }
  try {
    const sharedLabelCode = generateLabelCode();
    const orgs = await db.select().from(organizationsTable).limit(1);
    const orgName = orgs[0]?.name ?? "Church";

    const checkins: ReturnType<typeof serializeCheckin>[] = [];
    const labels: object[] = [];

    for (const item of items) {
      const reg = await db
        .select()
        .from(registrationsTable)
        .where(eq(registrationsTable.id, item.registrationId))
        .limit(1);
      if (!reg[0]) continue;
      const r = reg[0];

      const [checkin] = await db
        .insert(checkinsTable)
        .values({
          registrationId: item.registrationId,
          childFirstName: r.childFirstName,
          childLastName: r.childLastName,
          guardianName: r.guardianName,
          room: item.room ?? r.room ?? null,
          labelCode: sharedLabelCode,
          labelPrinted: false,
        })
        .returning();

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

    res.status(201).json({ checkins, labels });
  } catch (err) {
    req.log.error({ err }, "Failed to batch check-in");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/checkins", async (req, res) => {
  const dateStr = req.query.date as string | undefined;
  const formIdStr = req.query.formId as string | undefined;
  try {
    let checkins;

    if (formIdStr) {
      // Get all registrations for this form, then get their check-ins
      const formId = parseInt(formIdStr, 10);
      const regs = await db
        .select({ id: registrationsTable.id })
        .from(registrationsTable)
        .where(eq(registrationsTable.formId, formId));

      if (regs.length === 0) {
        res.json([]);
        return;
      }
      const regIds = regs.map((r) => r.id);
      checkins = await db
        .select()
        .from(checkinsTable)
        .where(inArray(checkinsTable.registrationId, regIds))
        .orderBy(desc(checkinsTable.checkinAt));
    } else if (dateStr) {
      const date = new Date(dateStr);
      checkins = await db
        .select()
        .from(checkinsTable)
        .where(gte(checkinsTable.checkinAt, date))
        .orderBy(desc(checkinsTable.checkinAt));
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      checkins = await db
        .select()
        .from(checkinsTable)
        .where(gte(checkinsTable.checkinAt, today))
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
    const { registrationId, room } = parsed.data;

    // Prevent duplicate active check-ins for the same registration
    const [activeCheckin] = await db
      .select()
      .from(checkinsTable)
      .where(and(eq(checkinsTable.registrationId, registrationId), isNull(checkinsTable.checkoutAt)))
      .limit(1);
    if (activeCheckin) {
      res.status(409).json({ error: "Already checked in", checkinId: activeCheckin.id });
      return;
    }

    const reg = await db
      .select()
      .from(registrationsTable)
      .where(eq(registrationsTable.id, registrationId))
      .limit(1);
    if (!reg[0]) {
      res.status(404).json({ error: "Registration not found" });
      return;
    }
    const r = reg[0];
    const labelCode = generateLabelCode();
    const [checkin] = await db
      .insert(checkinsTable)
      .values({
        registrationId,
        childFirstName: r.childFirstName,
        childLastName: r.childLastName,
        guardianName: r.guardianName,
        room: room ?? r.room ?? null,
        labelCode,
        labelPrinted: false,
      })
      .returning();

    const orgs = await db.select().from(organizationsTable).limit(1);
    const orgName = orgs[0]?.name ?? "Church";

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
    await db.delete(checkinsTable).where(eq(checkinsTable.id, checkinId));
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
    const [updated] = await db
      .update(checkinsTable)
      .set({ notes: notes !== undefined ? (notes.trim() || null) : undefined, updatedAt: new Date() })
      .where(eq(checkinsTable.id, checkinId))
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
    const [updated] = await db
      .update(checkinsTable)
      .set({ checkoutAt: null, pickupPersonName: null, updatedAt: new Date() })
      .where(eq(checkinsTable.id, checkinId))
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
    const [updated] = await db
      .update(checkinsTable)
      .set({
        checkoutAt: new Date(),
        updatedAt: new Date(),
        pickupPersonName: pickupPersonName?.trim() || null,
        notes: notes?.trim() || null,
      })
      .where(eq(checkinsTable.id, checkinId))
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
