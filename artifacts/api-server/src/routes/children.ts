import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, registrationsTable, checkinsTable } from "@workspace/db";
import { GetChildParams } from "@workspace/api-zod";

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

  return {
    id: reg.id,
    firstName: reg.childFirstName,
    lastName: reg.childLastName,
    dateOfBirth: reg.childDateOfBirth,
    guardianName: reg.guardianName,
    guardianPhone: reg.guardianPhone,
    guardianEmail: reg.guardianEmail,
    allergies: reg.allergies,
    medicalNotes: reg.medicalNotes,
    specialNeeds: reg.specialNeeds,
    room: reg.room,
    lastCheckinAt: lastCheckin[0]?.checkinAt?.toISOString() ?? null,
    registrationId: reg.id,
    isCheckedIn: active !== null,
    checkinId: active?.id ?? null,
    activeCheckinLabelCode: active?.labelCode ?? null,
  };
}

router.get("/children", async (req, res) => {
  const search = req.query.search as string | undefined;
  const eventIdStr = req.query.eventId as string | undefined;
  const eventId = eventIdStr ? parseInt(eventIdStr, 10) : undefined;
  try {
    const regs = await db
      .select()
      .from(registrationsTable)
      .where(eventId !== undefined ? eq(registrationsTable.eventId, eventId) : undefined)
      .orderBy(desc(registrationsTable.createdAt));

    const children = await Promise.all(regs.map(buildChild));

    if (search) {
      const lower = search.toLowerCase();
      const filtered = children.filter(
        (c) =>
          c.firstName.toLowerCase().includes(lower) ||
          c.lastName.toLowerCase().includes(lower) ||
          c.guardianName.toLowerCase().includes(lower) ||
          (c.guardianPhone && c.guardianPhone.replace(/\D/g, "").includes(lower.replace(/\D/g, "")))
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
    const reg = await db
      .select()
      .from(registrationsTable)
      .where(eq(registrationsTable.id, childId))
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
