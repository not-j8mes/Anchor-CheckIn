import { Router } from "express";
import { and, sql, gte, desc, eq, inArray } from "drizzle-orm";
import { db, formsTable, registrationsTable, checkinsTable, eventsTable } from "@workspace/db";
import { requireAuthContext } from "../lib/auth";

const router = Router();

router.get("/stats/dashboard", async (req, res) => {
  try {
    const auth = requireAuthContext(req);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const eventIdParam = req.query.eventId ? parseInt(req.query.eventId as string, 10) : null;

    // If filtering by event, resolve the form linked to that event
    let formId: number | null = null;
    if (eventIdParam) {
      const [ev] = await db.select({ formId: eventsTable.formId })
        .from(eventsTable)
        .where(and(eq(eventsTable.id, eventIdParam), eq(eventsTable.organizationId, auth.organizationId)))
        .limit(1);
      formId = ev?.formId ?? null;
    }

    // Subquery: registration IDs belonging to this event (or all)
    const regIdsSubquery = formId
      ? db.select({ id: registrationsTable.id }).from(registrationsTable).where(eq(registrationsTable.formId, formId))
      : db.select({ id: registrationsTable.id }).from(registrationsTable).where(eq(registrationsTable.organizationId, auth.organizationId));

    const [{ totalChildren }] = formId
      ? await db.select({ totalChildren: sql<number>`count(*)::int` }).from(registrationsTable).where(and(eq(registrationsTable.formId, formId), eq(registrationsTable.organizationId, auth.organizationId)))
      : await db.select({ totalChildren: sql<number>`count(*)::int` }).from(registrationsTable).where(eq(registrationsTable.organizationId, auth.organizationId));

    const [{ totalForms }] = await db
      .select({ totalForms: sql<number>`count(*)::int` })
      .from(formsTable)
      .where(eq(formsTable.organizationId, auth.organizationId));

    const [{ checkedInToday }] = await db
      .select({ checkedInToday: sql<number>`count(*)::int` })
      .from(checkinsTable)
      .where(
        formId
          ? sql`${checkinsTable.checkinAt} >= ${today} AND ${checkinsTable.organizationId} = ${auth.organizationId} AND ${checkinsTable.registrationId} IN (${regIdsSubquery})`
          : and(gte(checkinsTable.checkinAt, today), eq(checkinsTable.organizationId, auth.organizationId))
      );

    const [{ totalCheckins }] = await db
      .select({ totalCheckins: sql<number>`count(*)::int` })
      .from(checkinsTable)
      .where(
        formId
          ? and(inArray(checkinsTable.registrationId, regIdsSubquery), eq(checkinsTable.organizationId, auth.organizationId))
          : eq(checkinsTable.organizationId, auth.organizationId)
      );

    const recentRegistrations = formId
      ? await db.select().from(registrationsTable).where(and(eq(registrationsTable.formId, formId), eq(registrationsTable.organizationId, auth.organizationId))).orderBy(desc(registrationsTable.createdAt)).limit(5)
      : await db.select().from(registrationsTable).where(eq(registrationsTable.organizationId, auth.organizationId)).orderBy(desc(registrationsTable.createdAt)).limit(5);

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
    const auth = requireAuthContext(req);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const eventIdParam = req.query.eventId ? parseInt(req.query.eventId as string, 10) : null;

    let formId: number | null = null;
    if (eventIdParam) {
      const [ev] = await db.select({ formId: eventsTable.formId })
        .from(eventsTable)
        .where(and(eq(eventsTable.id, eventIdParam), eq(eventsTable.organizationId, auth.organizationId)))
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
          ? sql`${checkinsTable.checkinAt} >= ${thirtyDaysAgo} AND ${checkinsTable.organizationId} = ${auth.organizationId} AND ${checkinsTable.registrationId} IN (${regIdsSubquery})`
          : and(gte(checkinsTable.checkinAt, thirtyDaysAgo), eq(checkinsTable.organizationId, auth.organizationId))
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
