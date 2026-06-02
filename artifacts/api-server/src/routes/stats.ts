import { Router } from "express";
import { sql, gte, desc, eq, inArray } from "drizzle-orm";
import { db, formsTable, registrationsTable, checkinsTable, eventsTable } from "@workspace/db";

const router = Router();

router.get("/stats/dashboard", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const eventIdParam = req.query.eventId ? parseInt(req.query.eventId as string, 10) : null;

    // If filtering by event, resolve the form linked to that event
    let formId: number | null = null;
    if (eventIdParam) {
      const [ev] = await db.select({ formId: eventsTable.formId })
        .from(eventsTable)
        .where(eq(eventsTable.id, eventIdParam))
        .limit(1);
      formId = ev?.formId ?? null;
    }

    // Subquery: registration IDs belonging to this event (or all)
    const regIdsSubquery = formId
      ? db.select({ id: registrationsTable.id }).from(registrationsTable).where(eq(registrationsTable.formId, formId))
      : db.select({ id: registrationsTable.id }).from(registrationsTable);

    const [{ totalChildren }] = formId
      ? await db.select({ totalChildren: sql<number>`count(*)::int` }).from(registrationsTable).where(eq(registrationsTable.formId, formId))
      : await db.select({ totalChildren: sql<number>`count(*)::int` }).from(registrationsTable);

    const [{ totalForms }] = await db
      .select({ totalForms: sql<number>`count(*)::int` })
      .from(formsTable);

    const [{ checkedInToday }] = await db
      .select({ checkedInToday: sql<number>`count(*)::int` })
      .from(checkinsTable)
      .where(
        formId
          ? sql`${checkinsTable.checkinAt} >= ${today} AND ${checkinsTable.registrationId} IN (${regIdsSubquery})`
          : gte(checkinsTable.checkinAt, today)
      );

    const [{ totalCheckins }] = await db
      .select({ totalCheckins: sql<number>`count(*)::int` })
      .from(checkinsTable)
      .where(
        formId
          ? inArray(checkinsTable.registrationId, regIdsSubquery)
          : sql`1=1`
      );

    const recentRegistrations = formId
      ? await db.select().from(registrationsTable).where(eq(registrationsTable.formId, formId)).orderBy(desc(registrationsTable.createdAt)).limit(5)
      : await db.select().from(registrationsTable).orderBy(desc(registrationsTable.createdAt)).limit(5);

    res.json({
      totalChildren,
      totalForms,
      totalRegistrations: totalChildren,
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

    const eventIdParam = req.query.eventId ? parseInt(req.query.eventId as string, 10) : null;

    let formId: number | null = null;
    if (eventIdParam) {
      const [ev] = await db.select({ formId: eventsTable.formId })
        .from(eventsTable)
        .where(eq(eventsTable.id, eventIdParam))
        .limit(1);
      formId = ev?.formId ?? null;
    }

    const regIdsSubquery = formId
      ? db.select({ id: registrationsTable.id }).from(registrationsTable).where(eq(registrationsTable.formId, formId))
      : null;

    const rows = await db
      .select({
        date: sql<string>`date_trunc('day', ${checkinsTable.checkinAt})::date::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(checkinsTable)
      .where(
        regIdsSubquery
          ? sql`${checkinsTable.checkinAt} >= ${thirtyDaysAgo} AND ${checkinsTable.registrationId} IN (${regIdsSubquery})`
          : gte(checkinsTable.checkinAt, thirtyDaysAgo)
      )
      .groupBy(sql`date_trunc('day', ${checkinsTable.checkinAt})`)
      .orderBy(sql`date_trunc('day', ${checkinsTable.checkinAt})`);

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get checkins by day");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
