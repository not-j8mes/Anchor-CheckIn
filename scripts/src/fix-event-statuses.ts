/**
 * One-time fix: recompute and store status for all events based on their dates.
 *
 * Run: pnpm --filter @workspace/scripts run fix-event-statuses
 */

import { db, pool, eventsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const today = new Date().toISOString().slice(0, 10);

function computeStatus(startDate: string | null, endDate: string | null): string {
  if (!startDate) return "upcoming";
  const end = endDate || startDate;
  if (end < today) return "completed";
  if (startDate <= today) return "active";
  return "upcoming";
}

const events = await db.select({
  id: eventsTable.id,
  name: eventsTable.name,
  startDate: eventsTable.startDate,
  endDate: eventsTable.endDate,
  status: eventsTable.status,
}).from(eventsTable);

console.log(`Found ${events.length} event(s). Today: ${today}\n`);

let updated = 0;
for (const event of events) {
  const computed = computeStatus(event.startDate, event.endDate);
  if (computed !== event.status) {
    await db.update(eventsTable).set({ status: computed }).where(eq(eventsTable.id, event.id));
    console.log(`  UPDATED  "${event.name}"  (${event.startDate ?? "no date"})  ${event.status} → ${computed}`);
    updated++;
  } else {
    console.log(`  ok       "${event.name}"  (${event.startDate ?? "no date"})  ${event.status}`);
  }
}

console.log(`\nDone — ${updated} event(s) updated.`);
await pool.end();
