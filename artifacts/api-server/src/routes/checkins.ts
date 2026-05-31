import { Router } from "express";
import { eq, gte, desc } from "drizzle-orm";
import { db, checkinsTable, registrationsTable, organizationsTable } from "@workspace/db";
import { CreateCheckinBody, CheckoutChildParams } from "@workspace/api-zod";
import { randomBytes } from "crypto";

const router = Router();

function generateLabelCode(): string {
  return randomBytes(3).toString("hex").toUpperCase();
}

router.get("/checkins", async (req, res) => {
  const dateStr = req.query.date as string | undefined;
  try {
    let checkins;
    if (dateStr) {
      const date = new Date(dateStr);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
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
    res.json(
      checkins.map((c) => ({
        ...c,
        childId: c.registrationId,
        checkinAt: c.checkinAt.toISOString(),
        checkoutAt: c.checkoutAt?.toISOString() ?? null,
      }))
    );
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

    res.status(201).json({
      checkin: {
        ...checkin,
        childId: checkin.registrationId,
        checkinAt: checkin.checkinAt.toISOString(),
        checkoutAt: null,
      },
      labelData,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create checkin");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/checkins/:checkinId/checkout", async (req, res) => {
  const { checkinId: checkinIdStr } = CheckoutChildParams.parse(req.params);
  const checkinId = Number(checkinIdStr);
  try {
    const [updated] = await db
      .update(checkinsTable)
      .set({ checkoutAt: new Date() })
      .where(eq(checkinsTable.id, checkinId))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({
      ...updated,
      childId: updated.registrationId,
      checkinAt: updated.checkinAt.toISOString(),
      checkoutAt: updated.checkoutAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to checkout");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
