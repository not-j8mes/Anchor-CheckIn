import { Router } from "express";
import { eq, asc } from "drizzle-orm";
import { db, eventsTable, eventSessionsTable } from "@workspace/db";

const router = Router();

router.get("/events/:eventId/sessions", async (req, res) => {
  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid eventId" }); return; }
  try {
    const sessions = await db
      .select()
      .from(eventSessionsTable)
      .where(eq(eventSessionsTable.eventId, eventId))
      .orderBy(asc(eventSessionsTable.sessionDate));

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

export function computeSessionDates(
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
    sessions.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 7);
  }

  return sessions;
}

export async function createEventSessions(
  eventId: number,
  startDate: string,
  endDate: string,
  dayOfWeek: number,
  startTime: string | null,
  endTime: string | null
): Promise<void> {
  const dates = computeSessionDates(startDate, endDate, dayOfWeek);
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
