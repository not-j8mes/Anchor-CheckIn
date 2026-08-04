import assert from "node:assert/strict";
import test from "node:test";
import {
  sortStaffMembers,
  staffLabelFontSize,
  staffLabelName,
} from "./StaffTabContent";

test("staff can be sorted by first or last name", () => {
  const members = [
    { firstName: "Zoe", lastName: "Adams" },
    { firstName: "Anna", lastName: "Young" },
    { firstName: "Ben", lastName: "Adams" },
  ];
  assert.deepEqual(
    sortStaffMembers(members, "firstName").map((member) => member.firstName),
    ["Anna", "Ben", "Zoe"],
  );
  assert.deepEqual(
    sortStaffMembers(members, "lastName").map((member) => member.firstName),
    ["Ben", "Zoe", "Anna"],
  );
});

test("staff label names shrink instead of being truncated", () => {
  assert.equal(staffLabelFontSize("Jordan Taylor"), 28);
  assert.ok(
    staffLabelFontSize("Alexandria Montgomery-Wellington") <
      staffLabelFontSize("Jordan Taylor"),
  );
});

test("staff label name applies salutation and last-name format settings", () => {
  const member = { salutation: "Dr", firstName: "Jordan", lastName: "Taylor" };
  assert.equal(
    staffLabelName(member, { showSalutation: true, lastNameFormat: "full" }),
    "Dr Jordan Taylor",
  );
  assert.equal(
    staffLabelName(member, { showSalutation: false, lastNameFormat: "initial" }),
    "Jordan T.",
  );
  assert.equal(
    staffLabelName(member, { showSalutation: true, lastNameFormat: "hidden" }),
    "Dr Jordan",
  );
});
