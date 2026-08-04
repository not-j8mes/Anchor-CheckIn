import assert from "node:assert/strict";
import test from "node:test";
import { staffInitials, staffLabelName } from "./StaffTabContent";

test("staff initials support a single full-name field", () => {
  assert.equal(staffInitials("Jordan", "Taylor"), "JT");
  assert.equal(staffInitials("Prince"), "P");
  assert.equal(staffInitials("  Ana María ", " López  "), "AL");
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
