import assert from "node:assert/strict";
import test from "node:test";
import { defaultReportSessionDate } from "./report-session-selection";

const dates = ["2026-08-07", "2026-08-03", "2026-08-05"];

test("selects an exact session matching today", () => {
  assert.equal(defaultReportSessionDate(dates, "2026-08-05"), "2026-08-05");
});

test("selects the latest past session when between dates", () => {
  assert.equal(defaultReportSessionDate(dates, "2026-08-06"), "2026-08-05");
});

test("selects the earliest future session before an event", () => {
  assert.equal(defaultReportSessionDate(dates, "2026-08-01"), "2026-08-03");
});

test("selects the final session after an event", () => {
  assert.equal(defaultReportSessionDate(dates, "2026-08-10"), "2026-08-07");
});
