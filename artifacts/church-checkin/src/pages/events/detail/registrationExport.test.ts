import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCsv,
  csvCell,
  selectRegistrationExportRows,
  type RegistrationExportRow,
} from "./registrationExport";

const row = (id: number, room: string): RegistrationExportRow =>
  ({ id, room }) as RegistrationExportRow;

test("CSV cells escape commas, quotes, and line breaks", () => {
  assert.equal(csvCell("Smith, Jane"), '"Smith, Jane"');
  assert.equal(csvCell('Said "hello"'), '"Said ""hello"""');
  assert.equal(csvCell("line one\nline two"), '"line one\nline two"');
});

test("CSV output includes a UTF-8 BOM and CRLF rows", () => {
  assert.equal(buildCsv(["Name"], [["Zoë"]]), "\uFEFFName\r\nZoë");
});

test("filtered export returns only currently filtered registration IDs", () => {
  const rows = [row(1, "Nursery"), row(2, "Toddlers")];
  assert.deepEqual(
    selectRegistrationExportRows(rows, "filtered", new Set([2]), [], false),
    [rows[1]],
  );
});

test("room export supports selected rooms and unassigned registrations", () => {
  const rows = [row(1, "Nursery"), row(2, "Toddlers"), row(3, "")];
  assert.deepEqual(
    selectRegistrationExportRows(rows, "rooms", new Set(), ["Nursery"], true),
    [rows[0], rows[2]],
  );
});
