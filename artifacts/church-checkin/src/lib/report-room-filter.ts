export const ALL_REPORT_ROOMS = "__all_rooms__";
export const UNASSIGNED_REPORT_ROOM = "__unassigned_room__";

type CheckinWithRoom = { room?: string | null };

export function filterCheckinsByRoom<T extends CheckinWithRoom>(
  checkins: T[],
  roomFilter: string,
): T[] {
  if (roomFilter === ALL_REPORT_ROOMS) return checkins;
  if (roomFilter === UNASSIGNED_REPORT_ROOM) {
    return checkins.filter((checkin) => !checkin.room?.trim());
  }
  return checkins.filter((checkin) => checkin.room?.trim() === roomFilter);
}

export function reportRoomOptions(checkins: CheckinWithRoom[]): string[] {
  return [...new Set(
    checkins
      .map((checkin) => checkin.room?.trim())
      .filter((room): room is string => Boolean(room)),
  )].sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base", numeric: true }),
  );
}
