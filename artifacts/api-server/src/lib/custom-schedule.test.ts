import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeCustomDates, InvalidCustomDatesError } from "./custom-schedule";

test("custom schedules preserve gaps, sort dates and remove duplicates", () => {
  assert.deepEqual(normalizeCustomDates(["2026-10-23", "2026-09-29", "2026-10-08", "2026-09-29"]),
    ["2026-09-29", "2026-10-08", "2026-10-23"]);
});

test("custom schedules reject missing, malformed and impossible dates", () => {
  for (const value of [undefined, [], "2026-10-08", [null], ["2026-02-30"], ["2026-13-01"], ["2026-2-01"], ["2026-10-08T00:00:00Z"]]) {
    assert.throws(() => normalizeCustomDates(value), InvalidCustomDatesError);
  }
  assert.deepEqual(normalizeCustomDates(["2028-02-29"]), ["2028-02-29"]);
});
