import { Router } from "express";
import { and, eq, asc, gte, lte } from "drizzle-orm";
import { db, eventsTable, eventSessionsTable } from "@workspace/db";

const router = Router();

router.get("/events/:eventId/sessions", async (req, res) => {
  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid eventId" }); return; }
  try {
    await ensureEventDateSessions(eventId);
    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
    if (!event?.startDate) {
      res.json([]);
      return;
    }

    const endDate = event.endDate || event.startDate;
    const allSessions = await db
      .select()
      .from(eventSessionsTable)
      .where(and(
        eq(eventSessionsTable.eventId, eventId),
        gte(eventSessionsTable.sessionDate, event.startDate),
        lte(eventSessionsTable.sessionDate, endDate)
      ))
      .orderBy(asc(eventSessionsTable.sessionDate));

    // For repeating events, only return dates that match the recurrence pattern.
    // This guards against stale daily sessions left over from before the event
    // was configured as repeating.
    const validDates = new Set(getValidSessionDates(event));
    const sessions = allSessions.filter((s) => validDates.has(s.sessionDate));

    res.json(sessions.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list event sessions");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/events/:eventId/sessions/today", async (req, res) => {
  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid eventId" }); return; }
  try {
    const session = await createOrGetTodaySession(eventId);
    res.status(201).json({
      ...session,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create today's event session");
    res.status(500).json({ error: "Internal server error" });
  }
});

export function computeWeeklySessionDates(
  startDate: string,
  endDate: string,
  dayOfWeek: number
): string[] {
  const sessions: string[] = [];
  const end = new Date(endDate + "T00:00:00");
  const current = new Date(startDate + "T00:00:00");

  while (current.getDay() !== dayOfWeek) {
    current.setDate(current.getDate() + 1);
  }

  while (current <= end) {
    sessions.push(toLocalDateKey(current));
    current.setDate(current.getDate() + 7);
  }

  return sessions;
}

function getValidSessionDates(event: {
  scheduleType: string;
  startDate: string | null;
  endDate: string | null;
  repeatDayOfWeek: number | null;
}): string[] {
  if (!event.startDate) return [];
  if (event.scheduleType === "repeating" && event.repeatDayOfWeek != null) {
    return computeWeeklySessionDates(event.startDate, event.endDate || event.startDate, event.repeatDayOfWeek);
  }
  return computeDailySessionDates(event.startDate, event.endDate);
}

function getDefaultSessionDate(dates: string[], today: string): string | null {
  if (dates.length === 0) return null;
  const todaySession = dates.find((date) => date === today);
  if (todaySession) return todaySession;
  const nextUpcoming = dates.find((date) => date > today);
  return nextUpcoming ?? dates[dates.length - 1]!;
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function computeDailySessionDates(startDate: string, endDate?: string | null): string[] {
  const sessions: string[] = [];
  const current = new Date(startDate + "T00:00:00");
  const end = new Date((endDate || startDate) + "T00:00:00");

  while (current <= end) {
    sessions.push(toLocalDateKey(current));
    current.setDate(current.getDate() + 1);
  }

  return sessions;
}

export async function ensureEventDateSessions(eventId: number): Promise<void> {
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
  if (!event?.startDate) return;

  const dates = getValidSessionDates(event);
  if (dates.length === 0) return;

  const existing = await db
    .select({ sessionDate: eventSessionsTable.sessionDate })
    .from(eventSessionsTable)
    .where(eq(eventSessionsTable.eventId, eventId));
  const existingDates = new Set(existing.map((session) => session.sessionDate));
  const missingDates = dates.filter((date) => !existingDates.has(date));

  if (missingDates.length === 0) return;

  await db.insert(eventSessionsTable).values(
    missingDates.map((sessionDate) => ({
      eventId,
      sessionDate,
      startTime: event.startTime || null,
      endTime: event.endTime || null,
      status: "scheduled" as const,
    }))
  );
}

export async function createOrGetTodaySession(eventId: number): Promise<typeof eventSessionsTable.$inferSelect> {
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
  if (!event?.startDate) throw new Error("Event has no start date");

  const today = toLocalDateKey(new Date());
  const validDates = getValidSessionDates(event);
  const sessionDate = getDefaultSessionDate(validDates, today);
  if (!sessionDate) throw new Error("Event has no valid sessions");
  const [existing] = await db
    .select()
    .from(eventSessionsTable)
    .where(and(eq(eventSessionsTable.eventId, eventId), eq(eventSessionsTable.sessionDate, sessionDate)))
    .limit(1);
  if (existing) return existing;

  const [created] = await db.insert(eventSessionsTable).values({
    eventId,
    sessionDate,
    startTime: event?.startTime || null,
    endTime: event?.endTime || null,
    status: "scheduled" as const,
  }).returning();
  return created!;
}

export async function createEventSessions(
  eventId: number,
  startDate: string,
  endDate: string,
  dayOfWeek: number,
  startTime: string | null,
  endTime: string | null
): Promise<void> {
  const dates = computeWeeklySessionDates(startDate, endDate, dayOfWeek);
  if (dates.length === 0) return;

  await db.insert(eventSessionsTable).values(
    dates.map((sessionDate) => ({
      eventId,
      sessionDate,
      startTime: startTime || null,
      endTime: endTime || null,
      status: "scheduled" as const,
    }))
  );
}

export default router;
