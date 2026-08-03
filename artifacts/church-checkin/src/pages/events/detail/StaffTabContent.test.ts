import assert from "node:assert/strict";
import test from "node:test";
import { staffInitials } from "./StaffTabContent";

test("staff initials support a single full-name field", () => {
  assert.equal(staffInitials("Jordan Taylor"), "JT");
  assert.equal(staffInitials("Prince"), "P");
  assert.equal(staffInitials("  Ana María López  "), "AL");
});
