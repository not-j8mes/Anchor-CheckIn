import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { summarizeRoomAttendance } from "./roomAttendance.ts";

const rooms = [
  { id: 1, name: "Nursery" },
  { id: 2, name: "Elementary" },
];

function registration(id: number, room: string | null = "Nursery") {
  return { id, room };
}

function checkin({
  id,
  registrationId,
  sessionId = 10,
  checkinAt,
  checkoutAt = null,
}: {
  id: number;
  registrationId: number;
  sessionId?: number;
  checkinAt: string;
  checkoutAt?: string | null;
}) {
  return { id, registrationId, sessionId, checkinAt, checkoutAt };
}

describe("summarizeRoomAttendance", () => {
  it("counts a registered child who has not checked in as Not Arrived", () => {
    const result = summarizeRoomAttendance({
      rooms,
      registrations: [registration(1)],
      checkins: [],
      selectedSessionId: 10,
    });
    assert.equal(result.rooms[0]?.notArrivedCount, 1);
  });

  it("counts an active check-in as In Now", () => {
    const result = summarizeRoomAttendance({
      rooms,
      registrations: [registration(1)],
      checkins: [
        checkin({
          id: 1,
          registrationId: 1,
          checkinAt: "2026-07-26T09:00:00.000Z",
        }),
      ],
      selectedSessionId: 10,
    });
    assert.equal(result.rooms[0]?.inNowCount, 1);
  });

  it("counts the latest checked-out cycle as Checked Out", () => {
    const result = summarizeRoomAttendance({
      rooms,
      registrations: [registration(1)],
      checkins: [
        checkin({
          id: 1,
          registrationId: 1,
          checkinAt: "2026-07-26T09:00:00.000Z",
          checkoutAt: "2026-07-26T10:00:00.000Z",
        }),
      ],
      selectedSessionId: 10,
    });
    assert.equal(result.rooms[0]?.checkedOutCount, 1);
  });

  it("moves a child who checks back in from Checked Out to In Now", () => {
    const result = summarizeRoomAttendance({
      rooms,
      registrations: [registration(1)],
      checkins: [
        checkin({
          id: 1,
          registrationId: 1,
          checkinAt: "2026-07-26T09:00:00.000Z",
          checkoutAt: "2026-07-26T10:00:00.000Z",
        }),
        checkin({
          id: 2,
          registrationId: 1,
          checkinAt: "2026-07-26T11:00:00.000Z",
        }),
      ],
      selectedSessionId: 10,
    });
    assert.deepEqual(
      {
        inNow: result.rooms[0]?.inNowCount,
        checkedOut: result.rooms[0]?.checkedOutCount,
        notArrived: result.rooms[0]?.notArrivedCount,
      },
      { inNow: 1, checkedOut: 0, notArrived: 0 },
    );
  });

  it("assigns every registration to exactly one status and reconciles totals", () => {
    const result = summarizeRoomAttendance({
      rooms,
      registrations: [registration(1), registration(2), registration(3)],
      checkins: [
        checkin({
          id: 1,
          registrationId: 1,
          checkinAt: "2026-07-26T09:00:00.000Z",
        }),
        checkin({
          id: 2,
          registrationId: 2,
          checkinAt: "2026-07-26T09:05:00.000Z",
          checkoutAt: "2026-07-26T10:00:00.000Z",
        }),
      ],
      selectedSessionId: 10,
    });
    const nursery = result.rooms[0]!;
    assert.equal(
      nursery.inNowCount +
        nursery.checkedOutCount +
        nursery.notArrivedCount,
      nursery.registeredCount,
    );
    assert.deepEqual(result.totals, {
      registeredCount: 3,
      inNowCount: 1,
      checkedOutCount: 1,
      notArrivedCount: 1,
    });
  });

  it("does not mix attendance from separate event sessions", () => {
    const result = summarizeRoomAttendance({
      rooms,
      registrations: [registration(1)],
      checkins: [
        checkin({
          id: 1,
          registrationId: 1,
          sessionId: 9,
          checkinAt: "2026-07-19T09:00:00.000Z",
        }),
      ],
      selectedSessionId: 10,
    });
    assert.equal(result.rooms[0]?.notArrivedCount, 1);
  });

  it("uses the registration's current room after reassignment", () => {
    const result = summarizeRoomAttendance({
      rooms,
      registrations: [registration(1, "Elementary")],
      checkins: [
        checkin({
          id: 1,
          registrationId: 1,
          checkinAt: "2026-07-26T09:00:00.000Z",
        }),
      ],
      selectedSessionId: 10,
    });
    assert.equal(result.rooms[0]?.registeredCount, 0);
    assert.equal(result.rooms[1]?.registeredCount, 1);
    assert.equal(result.rooms[1]?.inNowCount, 1);
  });

  it("groups missing and unknown room assignments under Unassigned", () => {
    const result = summarizeRoomAttendance({
      rooms,
      registrations: [registration(1, null), registration(2, "Old Room")],
      checkins: [
        checkin({
          id: 1,
          registrationId: 1,
          checkinAt: "2026-07-26T09:00:00.000Z",
        }),
      ],
      selectedSessionId: 10,
    });
    const unassigned = result.rooms.at(-1)!;
    assert.equal(unassigned.roomName, "Unassigned");
    assert.deepEqual(
      {
        registered: unassigned.registeredCount,
        inNow: unassigned.inNowCount,
        notArrived: unassigned.notArrivedCount,
      },
      { registered: 2, inNow: 1, notArrived: 1 },
    );
  });

  it("handles events with no configured rooms", () => {
    const empty = summarizeRoomAttendance({
      rooms: [],
      registrations: [],
      checkins: [],
      selectedSessionId: 10,
    });
    assert.deepEqual(empty.rooms, []);

    const withRegistrant = summarizeRoomAttendance({
      rooms: [],
      registrations: [registration(1, null)],
      checkins: [],
      selectedSessionId: 10,
    });
    assert.equal(withRegistrant.rooms[0]?.roomName, "Unassigned");
    assert.equal(withRegistrant.rooms[0]?.notArrivedCount, 1);
  });
});
