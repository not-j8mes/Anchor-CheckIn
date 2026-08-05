import type { EventCheckin, Registration } from "@workspace/api-client-react";

export interface ReportSession {
  date: string;
  items: EventCheckin[];
}

export interface RoomAttendanceMetric {
  room: string;
  registered: number;
  attended: number;
  didNotAttend: number;
  rate: number;
}

export function calculateEventOverview({
  sessions,
  registrations,
  today,
}: {
  sessions: ReportSession[];
  registrations: Registration[];
  today: string;
}) {
  // A session dated today is considered occurred because configured session
  // options currently expose a calendar date, not a start datetime.
  const occurredSessions = sessions.filter((session) => session.date <= today);
  const attendanceCountByRegistrant = new Map<number, number>();
  let attendanceVisits = 0;
  for (const session of occurredSessions) {
    const sessionAttendeeIds = new Set(
      session.items.map((item) => item.registrationId),
    );
    attendanceVisits += sessionAttendeeIds.size;
    for (const id of sessionAttendeeIds) {
      attendanceCountByRegistrant.set(
        id,
        (attendanceCountByRegistrant.get(id) ?? 0) + 1,
      );
    }
  }
  const uniqueAttendees = attendanceCountByRegistrant.size;
  const repeatAttendees = [...attendanceCountByRegistrant.values()].filter(
    (count) => count >= 2,
  ).length;
  const singleSession = sessions.length === 1 ? sessions[0]! : null;
  const singleDayRegistered = singleSession
    ? getEligibleRegistrantsForSession(registrations, singleSession.date).length
    : 0;
  const singleDayAttended = singleSession
    ? new Set(singleSession.items.map((item) => item.registrationId)).size
    : 0;

  return {
    occurredSessionCount: occurredSessions.length,
    attendanceVisits,
    uniqueAttendees,
    averagePerSession:
      occurredSessions.length > 0
        ? attendanceVisits / occurredSessions.length
        : null,
    repeatAttendees,
    singleDay: {
      registered: singleDayRegistered,
      attended: singleDayAttended,
      attendanceRate: singleDayRegistered
        ? Math.round((singleDayAttended / singleDayRegistered) * 100)
        : 0,
    },
  };
}

const roomName = (value?: string | null) => value?.trim() || "Unassigned";

/**
 * Reports use the end of the session's local calendar day as the eligibility
 * cutoff because report sessions currently expose a date but no end datetime.
 * The application has no event-specific timezone setting, so "local" follows
 * the same browser/local timezone convention used by the rest of the desk.
 */
export function getSessionEligibilityCutoff(sessionDate: string): Date {
  const [year, month, day] = sessionDate.split("-").map(Number);
  return new Date(year!, month! - 1, day!, 23, 59, 59, 999);
}

export function getSessionStart(sessionDate: string): Date {
  const [year, month, day] = sessionDate.split("-").map(Number);
  return new Date(year!, month! - 1, day!, 0, 0, 0, 0);
}

export function isRegistrantEligibleForSession(
  registration: Registration,
  sessionDate: string,
): boolean {
  const createdAt = new Date(registration.createdAt).getTime();
  return (
    Number.isFinite(createdAt) &&
    createdAt <= getSessionEligibilityCutoff(sessionDate).getTime()
  );
}

export function getEligibleRegistrantsForSession(
  registrations: Registration[],
  sessionDate: string,
): Registration[] {
  return registrations.filter((registration) =>
    isRegistrantEligibleForSession(registration, sessionDate),
  );
}

export function calculateSessionReport({
  selectedDate,
  sessions,
  registrations,
  roomFilter,
}: {
  selectedDate: string;
  sessions: ReportSession[];
  registrations: Registration[];
  roomFilter: string;
}) {
  const allRooms = roomFilter === "__all_rooms__";
  const unassigned = roomFilter === "__unassigned_room__";
  const registrationMatchesRoom = (registration: Registration) =>
    allRooms ||
    (unassigned
      ? !registration.room?.trim()
      : registration.room?.trim() === roomFilter);
  const checkinMatchesRoom = (checkin: EventCheckin) =>
    allRooms ||
    (unassigned ? !checkin.room?.trim() : checkin.room?.trim() === roomFilter);

  const selected = sessions.find((session) => session.date === selectedDate);
  const selectedCheckins = (selected?.items ?? []).filter(checkinMatchesRoom);
  const attendedIds = new Set(selectedCheckins.map((item) => item.registrationId));
  // Historical snapshot first, room filter second. Each child added to a family
  // has its own registration row and immutable createdAt timestamp.
  const historicallyEligible = getEligibleRegistrantsForSession(
    registrations,
    selectedDate,
  );
  const inconsistentAttendanceIds = new Set(
    registrations
      .filter(
        (registration) =>
          attendedIds.has(registration.id) &&
          !isRegistrantEligibleForSession(registration, selectedDate),
      )
      .map((registration) => registration.id),
  );
  const eligible = historicallyEligible.filter(registrationMatchesRoom);
  const earlierSessions = sessions.filter((session) => session.date < selectedDate);
  const earlierAttendanceIds = new Set(
    earlierSessions.flatMap((session) => session.items.map((item) => item.registrationId)),
  );
  const firstTimeIds = new Set(
    [...attendedIds].filter((id) => !earlierAttendanceIds.has(id)),
  );
  const attendedRecords = [...attendedIds].map((registrationId) => {
    const records = selectedCheckins
      .filter((item) => item.registrationId === registrationId)
      .sort(
        (a, b) =>
          new Date(a.checkinAt).getTime() - new Date(b.checkinAt).getTime(),
      );
    const hasActiveRecord = records.some((item) => !item.checkoutAt);
    const finalCheckout = hasActiveRecord
      ? null
      : records
          .map((item) => item.checkoutAt)
          .filter((value): value is string => Boolean(value))
          .sort()
          .at(-1) ?? null;
    return {
      registrationId,
      registration: registrations.find((item) => item.id === registrationId) ?? null,
      firstCheckin: records[0]!,
      finalCheckout,
    };
  });

  const roomMap = new Map<string, RoomAttendanceMetric>();
  for (const registration of eligible) {
    const room = roomName(registration.room);
    const metric = roomMap.get(room) ?? {
      room,
      registered: 0,
      attended: 0,
      didNotAttend: 0,
      rate: 0,
    };
    metric.registered += 1;
    if (attendedIds.has(registration.id)) metric.attended += 1;
    else metric.didNotAttend += 1;
    roomMap.set(room, metric);
  }
  const attendanceByRoom = [...roomMap.values()]
    .map((metric) => ({
      ...metric,
      rate: metric.registered
        ? Math.round((metric.attended / metric.registered) * 100)
        : 0,
    }))
    .sort((a, b) => a.room.localeCompare(b.room));

  const intervalMap = new Map<number, number>();
  for (const checkin of selectedCheckins) {
    const date = new Date(checkin.checkinAt);
    date.setMinutes(Math.floor(date.getMinutes() / 15) * 15, 0, 0);
    const key = date.getTime();
    intervalMap.set(key, (intervalMap.get(key) ?? 0) + 1);
  }
  const checkInIntervals = [...intervalMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([start, count]) => ({ start: new Date(start), count }));

  const orderedDates = sessions.map((session) => session.date).sort();
  const selectedIndex = orderedDates.indexOf(selectedDate);
  const throughSelected = orderedDates.slice(0, selectedIndex + 1);
  const attendanceByDate = new Map(
    sessions.map((session) => [
      session.date,
      new Set(session.items.map((item) => item.registrationId)),
    ]),
  );
  const previousDate = selectedIndex > 0 ? orderedDates[selectedIndex - 1] : null;
  const registrationById = new Map(
    registrations.map((registration) => [registration.id, registration]),
  );
  const eligibleOnDate = (id: number, date: string) => {
    const registration = registrationById.get(id);
    return !registration || isRegistrantEligibleForSession(registration, date);
  };
  const attendedEverySession = [...attendedIds].filter((id) => {
    const eligibleDates = throughSelected.filter((date) => eligibleOnDate(id, date));
    return eligibleDates.every((date) => attendanceByDate.get(date)?.has(id));
  }).length;
  const missedPrevious = previousDate
    ? [...attendedIds].filter(
        (id) =>
          eligibleOnDate(id, previousDate) &&
          !attendanceByDate.get(previousDate)?.has(id),
      ).length
    : 0;
  const returnedAfterAbsence = [...attendedIds].filter((id) => {
    const eligibleEarlierDates = throughSelected
      .slice(0, -1)
      .filter((date) => eligibleOnDate(id, date));
    const attendedEarlier = eligibleEarlierDates.some((date) =>
      attendanceByDate.get(date)?.has(id),
    );
    const missedEarlier = eligibleEarlierDates.some((date) =>
      !attendanceByDate.get(date)?.has(id),
    );
    return attendedEarlier && missedEarlier;
  }).length;

  const validDurations = selectedCheckins
    .filter((item) => item.checkoutAt)
    .map((item) => new Date(item.checkoutAt!).getTime() - new Date(item.checkinAt).getTime())
    .filter((duration) => duration >= 0);
  const checkedOutItems = selectedCheckins.filter((item) => item.checkoutAt);
  const newRegistrations = registrations
    .filter(registrationMatchesRoom)
    .filter((registration) => {
      const createdAt = new Date(registration.createdAt).getTime();
      return (
        Number.isFinite(createdAt) &&
        createdAt >= getSessionStart(selectedDate).getTime() &&
        createdAt <= getSessionEligibilityCutoff(selectedDate).getTime()
      );
    });
  const didNotAttendRegistrations = eligible.filter(
    (registration) => !attendedIds.has(registration.id),
  );

  return {
    selectedCheckins,
    attendedRecords,
    eligibleRegistrations: eligible,
    didNotAttendRegistrations,
    inconsistentAttendanceIds: [...inconsistentAttendanceIds],
    newRegistrations,
    firstTimeAttendeeRecords: attendedRecords.filter((record) =>
      firstTimeIds.has(record.registrationId),
    ),
    attendedCount: attendedIds.size,
    newRegistrationsCount: newRegistrations.length,
    didNotAttendCount: didNotAttendRegistrations.length,
    firstTimeAttendeeCount: firstTimeIds.size,
    returningAttendeeCount: attendedIds.size - firstTimeIds.size,
    attendanceByRoom,
    checkInIntervals,
    multiDay: {
      attendedThisSession: attendedIds.size,
      attendedEverySession,
      missedPrevious,
      returnedAfterAbsence,
    },
    checkout: {
      averageDurationMs: validDurations.length
        ? validDurations.reduce((sum, value) => sum + value, 0) / validDurations.length
        : null,
      earliestCheckout: checkedOutItems
        .map((item) => item.checkoutAt!)
        .sort()[0] ?? null,
      latestCheckout: checkedOutItems
        .map((item) => item.checkoutAt!)
        .sort()
        .at(-1) ?? null,
      missingCheckoutCount: selectedCheckins.filter((item) => !item.checkoutAt).length,
    },
  };
}
