import assert from "node:assert/strict";
import test from "node:test";
import type { EventCheckin, Registration } from "@workspace/api-client-react";
import {
  calculateEventOverview,
  calculateSessionReport,
} from "./session-report-metrics";

const registrations = [
  { id: 1, formId: 1, childFirstName: "A", childLastName: "One", room: "Blue", createdAt: "2026-08-01T12:00:00" },
  { id: 2, formId: 1, childFirstName: "B", childLastName: "Two", room: "Blue", createdAt: "2026-08-04T10:00:00" },
  { id: 3, formId: 1, childFirstName: "C", childLastName: "Three", room: "Red", createdAt: "2026-08-04T11:00:00" },
] as Registration[];

const checkin = (id: number, registrationId: number, date: string, room = "Blue", checkoutAt?: string): EventCheckin => ({
  id,
  registrationId,
  childFirstName: "Child",
  childLastName: String(registrationId),
  guardianName: "Guardian",
  room,
  labelCode: "CODE",
  checkinAt: `${date}T18:02:00`,
  checkoutAt,
});

const sessions = [
  { date: "2026-08-03", items: [checkin(1, 1, "2026-08-03")] },
  {
    date: "2026-08-04",
    items: [
      checkin(2, 1, "2026-08-04", "Blue", "2026-08-04T19:00:00"),
      checkin(3, 1, "2026-08-04"),
      checkin(4, 2, "2026-08-04"),
    ],
  },
];

test("session metrics count unique attendance and distinguish first-time from returning", () => {
  const report = calculateSessionReport({ selectedDate: "2026-08-04", sessions, registrations, roomFilter: "__all_rooms__" });
  assert.equal(report.attendedCount, 2);
  assert.equal(report.attendedRecords.length, report.attendedCount);
  assert.equal(report.firstTimeAttendeeCount, 1);
  assert.equal(report.firstTimeAttendeeRecords.length, report.firstTimeAttendeeCount);
  assert.equal(report.returningAttendeeCount, 1);
  assert.equal(report.didNotAttendCount, 1);
  assert.equal(report.didNotAttendRegistrations.length, report.didNotAttendCount);
  assert.equal(report.newRegistrationsCount, 2);
  assert.equal(report.newRegistrations.length, report.newRegistrationsCount);
  assert.equal(report.attendanceByRoom.find((room) => room.room === "Blue")?.rate, 100);
  assert.equal(report.checkInIntervals[0]?.count, 3);
});

test("room filtering updates all primary session metrics", () => {
  const report = calculateSessionReport({ selectedDate: "2026-08-04", sessions, registrations, roomFilter: "Red" });
  assert.equal(report.attendedCount, 0);
  assert.equal(report.newRegistrationsCount, 1);
  assert.equal(report.didNotAttendCount, 1);
  assert.equal(report.firstTimeAttendeeCount, 0);
  assert.equal(report.attendanceByRoom[0]?.rate, 0);
  assert.equal(report.didNotAttendRegistrations.length, report.didNotAttendCount);
});

test("later registrations are excluded from earlier historical eligibility", () => {
  const report = calculateSessionReport({
    selectedDate: "2026-08-03",
    sessions,
    registrations,
    roomFilter: "__all_rooms__",
  });
  assert.deepEqual(report.eligibleRegistrations.map((item) => item.id), [1]);
  assert.equal(report.didNotAttendCount, 0);
  assert.equal(report.attendanceByRoom[0]?.registered, 1);
  assert.equal(report.attendanceByRoom[0]?.rate, 100);
});

test("a child becomes eligible and new on their own creation date", () => {
  const report = calculateSessionReport({
    selectedDate: "2026-08-04",
    sessions,
    registrations,
    roomFilter: "Red",
  });
  assert.deepEqual(report.eligibleRegistrations.map((item) => item.id), [3]);
  assert.deepEqual(report.didNotAttendRegistrations.map((item) => item.id), [3]);
  assert.equal(report.newRegistrationsCount, 1);
});

test("same-day registrations are eligible through the end-of-day cutoff", () => {
  const lateRegistration = {
    ...registrations[0]!,
    id: 4,
    createdAt: "2026-08-04T23:59:00",
  };
  const report = calculateSessionReport({
    selectedDate: "2026-08-04",
    sessions,
    registrations: [lateRegistration],
    roomFilter: "__all_rooms__",
  });
  assert.equal(report.eligibleRegistrations.length, 1);
  assert.equal(report.newRegistrationsCount, 1);
});

test("event overview deduplicates people within sessions and counts repeats across sessions", () => {
  const overview = calculateEventOverview({
    sessions: [
      sessions[0]!,
      sessions[1]!,
      { date: "2026-08-05", items: [] },
      { date: "2026-08-10", items: [checkin(9, 3, "2026-08-10", "Red")] },
    ],
    registrations,
    today: "2026-08-05",
  });
  assert.equal(overview.uniqueAttendees, 2);
  assert.equal(overview.attendanceVisits, 3);
  assert.equal(overview.occurredSessionCount, 3);
  assert.equal(overview.averagePerSession, 1);
  assert.equal(overview.repeatAttendees, 1);
});

test("event overview handles no occurred sessions and single-day events", () => {
  const future = calculateEventOverview({
    sessions: [{ date: "2026-08-10", items: [] }],
    registrations,
    today: "2026-08-01",
  });
  assert.equal(future.averagePerSession, null);
  assert.equal(future.repeatAttendees, 0);
  assert.equal(future.singleDay.registered, 3);
  assert.equal(future.singleDay.attended, 0);
  assert.equal(future.singleDay.attendanceRate, 0);
});
