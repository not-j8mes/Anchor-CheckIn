import assert from "node:assert/strict";
import { test } from "node:test";
import { eq, asc } from "drizzle-orm";

process.env.DATABASE_URL ??= "postgresql://localhost:5432/anchor_checkin";
process.env.SESSION_SECRET ??= "custom-schedule-test-secret";

test("custom events persist only selected sessions, including after check-in initialization", async () => {
  const { db, pool, organizationsTable, eventSessionsTable, formsTable } = await import("@workspace/db");
  const { createEventWithForm } = await import("./events");
  const { ensureEventDateSessions, createOrGetTodaySession } = await import("./event-sessions");
  const [organization] = await db.insert(organizationsTable).values({ name: "Custom schedule test" }).returning();
  try {
    const dates = ["2099-01-06", "2099-01-15", "2099-02-06"];
    const { event } = await createEventWithForm({
      organizationId: organization.id, name: "Irregular event", eventType: "general",
      formTitle: "Test registration", registrationType: "individual", addDefaultQuestions: false,
      scheduleType: "custom", customDates: [dates[2], dates[0], dates[1], dates[0]],
      startDate: "2000-01-01", endDate: "2100-01-01", startTime: "09:00", endTime: "11:00",
      repeatDayOfWeek: 1,
    });
    assert.equal(event.startDate, dates[0]);
    assert.equal(event.endDate, dates[2]);
    assert.equal(event.repeatDayOfWeek, null);
    await ensureEventDateSessions(event.id);
    await ensureEventDateSessions(event.id);
    const todaySession = await createOrGetTodaySession(event.id);
    assert.equal(todaySession.sessionDate, dates[0]);
    const sessions = await db.select().from(eventSessionsTable)
      .where(eq(eventSessionsTable.eventId, event.id)).orderBy(asc(eventSessionsTable.sessionDate));
    assert.deepEqual(sessions.map((session) => session.sessionDate), dates);
    assert.ok(sessions.every((session) => session.startTime === "09:00" && session.endTime === "11:00"));
    await assert.rejects(() => createEventWithForm({
      organizationId: organization.id, name: "Invalid", eventType: "general", formTitle: "Invalid",
      scheduleType: "custom", customDates: ["2026-02-30"],
    }), /valid calendar dates/);
    const forms = await db.select().from(formsTable).where(eq(formsTable.organizationId, organization.id));
    assert.equal(forms.length, 1, "invalid dates must be rejected before creating a form");
  } finally {
    await db.delete(organizationsTable).where(eq(organizationsTable.id, organization.id));
    await pool.end();
  }
});
