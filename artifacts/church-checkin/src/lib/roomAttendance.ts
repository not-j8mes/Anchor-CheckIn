export interface AttendanceRoom {
  id: number;
  name: string;
}

export interface AttendanceRegistration {
  id: number;
  room?: string | null;
}

export interface AttendanceCheckin {
  id: number;
  registrationId: number;
  sessionId?: number | null;
  checkinAt: string;
  checkoutAt?: string | null;
}

export interface RoomAttendanceSummary {
  roomId: number | null;
  roomName: string;
  registeredCount: number;
  inNowCount: number;
  checkedOutCount: number;
  notArrivedCount: number;
}

export interface RoomAttendanceResult {
  rooms: RoomAttendanceSummary[];
  totals: {
    registeredCount: number;
    inNowCount: number;
    checkedOutCount: number;
    notArrivedCount: number;
  };
}

function emptySummary(
  roomId: number | null,
  roomName: string,
): RoomAttendanceSummary {
  return {
    roomId,
    roomName,
    registeredCount: 0,
    inNowCount: 0,
    checkedOutCount: 0,
    notArrivedCount: 0,
  };
}

export function summarizeRoomAttendance({
  rooms,
  registrations,
  checkins,
  selectedSessionId,
}: {
  rooms: AttendanceRoom[];
  registrations: AttendanceRegistration[];
  checkins: AttendanceCheckin[];
  selectedSessionId: number | null | undefined;
}): RoomAttendanceResult {
  const summaries = rooms.map((room) => emptySummary(room.id, room.name));
  const firstSummaryByRoomName = new Map<string, RoomAttendanceSummary>();
  for (const summary of summaries) {
    if (!firstSummaryByRoomName.has(summary.roomName)) {
      firstSummaryByRoomName.set(summary.roomName, summary);
    }
  }

  const latestCheckinByRegistration = new Map<number, AttendanceCheckin>();
  if (selectedSessionId != null) {
    for (const checkin of checkins) {
      if (checkin.sessionId !== selectedSessionId) continue;
      const current = latestCheckinByRegistration.get(checkin.registrationId);
      if (
        !current ||
        new Date(checkin.checkinAt).getTime() >
          new Date(current.checkinAt).getTime() ||
        (checkin.checkinAt === current.checkinAt && checkin.id > current.id)
      ) {
        latestCheckinByRegistration.set(checkin.registrationId, checkin);
      }
    }
  }

  const unassigned = emptySummary(null, "Unassigned");
  for (const registration of registrations) {
    const roomName = registration.room?.trim();
    const summary =
      (roomName && firstSummaryByRoomName.get(roomName)) || unassigned;
    summary.registeredCount += 1;

    const latestCheckin = latestCheckinByRegistration.get(registration.id);
    if (!latestCheckin) {
      summary.notArrivedCount += 1;
    } else if (latestCheckin.checkoutAt) {
      summary.checkedOutCount += 1;
    } else {
      summary.inNowCount += 1;
    }
  }

  if (unassigned.registeredCount > 0) summaries.push(unassigned);

  const totals = summaries.reduce(
    (result, summary) => ({
      registeredCount: result.registeredCount + summary.registeredCount,
      inNowCount: result.inNowCount + summary.inNowCount,
      checkedOutCount: result.checkedOutCount + summary.checkedOutCount,
      notArrivedCount: result.notArrivedCount + summary.notArrivedCount,
    }),
    {
      registeredCount: 0,
      inNowCount: 0,
      checkedOutCount: 0,
      notArrivedCount: 0,
    },
  );

  return { rooms: summaries, totals };
}
