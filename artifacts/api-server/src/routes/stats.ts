import { Router } from "express";
import { sql, gte, desc } from "drizzle-orm";
import { db, formsTable, registrationsTable, checkinsTable } from "@workspace/db";

const router = Router();

router.get("/stats/dashboard", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [{ totalChildren }] = await db
      .select({ totalChildren: sql<number>`count(*)::int` })
      .from(registrationsTable);

    const [{ totalForms }] = await db
      .select({ totalForms: sql<number>`count(*)::int` })
      .from(formsTable);

    const [{ totalRegistrations }] = await db
      .select({ totalRegistrations: sql<number>`count(*)::int` })
      .from(registrationsTable);

    const [{ checkedInToday }] = await db
      .select({ checkedInToday: sql<number>`count(*)::int` })
      .from(checkinsTable)
      .where(gte(checkinsTable.checkinAt, today));

    const [{ totalCheckins }] = await db
      .select({ totalCheckins: sql<number>`count(*)::int` })
      .from(checkinsTable);

    const recentRegistrations = await db
      .select()
      .from(registrationsTable)
      .orderBy(desc(registrationsTable.createdAt))
      .limit(5);

    res.json({
      totalChildren,
      totalForms,
      totalRegistrations,
      checkedInToday,
      totalCheckins,
      recentRegistrations,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/stats/checkins-by-day", async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const rows = await db
      .select({
        date: sql<string>`date_trunc('day', ${checkinsTable.checkinAt})::date::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(checkinsTable)
      .where(gte(checkinsTable.checkinAt, thirtyDaysAgo))
      .groupBy(sql`date_trunc('day', ${checkinsTable.checkinAt})`)
      .orderBy(sql`date_trunc('day', ${checkinsTable.checkinAt})`);

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get checkins by day");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
