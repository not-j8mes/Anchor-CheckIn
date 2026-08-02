import assert from "node:assert/strict";
import test from "node:test";
import { generateLabelCode } from "./pickupCodes";

test("generated pickup codes always contain at least one number", () => {
  const code = generateLabelCode(Uint8Array.from([0, 1, 2, 3, 2, 4]));

  assert.match(code, /\d/);
  assert.equal(code.length, 4);
});

test("existing generated numbers are preserved", () => {
  const code = generateLabelCode(Uint8Array.from([24, 0, 1, 2, 3, 4]));

  assert.equal(code, "2ABC");
});
