import { Router } from "express";
import { eq, ilike, or, desc } from "drizzle-orm";
import { db, registrationsTable, checkinsTable } from "@workspace/db";
import { GetChildParams } from "@workspace/api-zod";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/children", async (req, res) => {
  const search = req.query.search as string | undefined;
  try {
    const regs = await db
      .select()
      .from(registrationsTable)
      .orderBy(desc(registrationsTable.createdAt));

    const children = await Promise.all(
      regs.map(async (reg) => {
        const lastCheckin = await db
          .select({ checkinAt: checkinsTable.checkinAt })
          .from(checkinsTable)
          .where(eq(checkinsTable.registrationId, reg.id))
          .orderBy(desc(checkinsTable.checkinAt))
          .limit(1);

        return {
          id: reg.id,
          firstName: reg.childFirstName,
          lastName: reg.childLastName,
          dateOfBirth: reg.childDateOfBirth,
          guardianName: reg.guardianName,
          guardianPhone: reg.guardianPhone,
          guardianEmail: reg.guardianEmail,
          allergies: reg.allergies,
          specialNeeds: reg.specialNeeds,
          room: reg.room,
          lastCheckinAt: lastCheckin[0]?.checkinAt?.toISOString() ?? null,
          registrationId: reg.id,
        };
      })
    );

    if (search) {
      const lower = search.toLowerCase();
      const filtered = children.filter(
        (c) =>
          c.firstName.toLowerCase().includes(lower) ||
          c.lastName.toLowerCase().includes(lower) ||
          c.guardianName.toLowerCase().includes(lower)
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
    const r = reg[0];
    const lastCheckin = await db
      .select({ checkinAt: checkinsTable.checkinAt })
      .from(checkinsTable)
      .where(eq(checkinsTable.registrationId, r.id))
      .orderBy(desc(checkinsTable.checkinAt))
      .limit(1);

    res.json({
      id: r.id,
      firstName: r.childFirstName,
      lastName: r.childLastName,
      dateOfBirth: r.childDateOfBirth,
      guardianName: r.guardianName,
      guardianPhone: r.guardianPhone,
      guardianEmail: r.guardianEmail,
      allergies: r.allergies,
      specialNeeds: r.specialNeeds,
      room: r.room,
      lastCheckinAt: lastCheckin[0]?.checkinAt?.toISOString() ?? null,
      registrationId: r.id,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get child");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
