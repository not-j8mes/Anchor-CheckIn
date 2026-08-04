import assert from "node:assert/strict";
import test from "node:test";
import {
  ALL_REPORT_ROOMS,
  UNASSIGNED_REPORT_ROOM,
  filterCheckinsByRoom,
  reportRoomOptions,
} from "./report-room-filter";

const checkins = [
  { id: 1, room: "Nursery" },
  { id: 2, room: "Grade 2" },
  { id: 3, room: null },
  { id: 4, room: "  Nursery  " },
];

test("filters report check-ins by room and unassigned status", () => {
  assert.equal(filterCheckinsByRoom(checkins, ALL_REPORT_ROOMS), checkins);
  assert.deepEqual(
    filterCheckinsByRoom(checkins, "Nursery").map((item) => item.id),
    [1, 4],
  );
  assert.deepEqual(
    filterCheckinsByRoom(checkins, UNASSIGNED_REPORT_ROOM).map(
      (item) => item.id,
    ),
    [3],
  );
});

test("builds unique alphabetical room options", () => {
  assert.deepEqual(reportRoomOptions(checkins), ["Grade 2", "Nursery"]);
});
