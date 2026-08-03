import assert from "node:assert/strict";
import test from "node:test";
import { sortDeskFamiliesByFirstChildLastName } from "./desk-family-sort";

const family = (
  groupId: number,
  children: Array<[id: number, firstName: string, lastName: string]>,
) => ({
  groupId,
  items: children.map(([id, childFirstName, childLastName]) => ({
    reg: { id, childFirstName, childLastName },
  })),
});

test("sorts families by the first listed child's last name", () => {
  const families = [
    family(1, [
      [10, "Zoe", "Taylor"],
      [11, "Aaron", "Adams"],
    ]),
    family(2, [[20, "Mia", "Brown"]]),
    family(3, [[30, "Liam", "Anderson"]]),
  ];

  assert.deepEqual(
    sortDeskFamiliesByFirstChildLastName(families).map(
      (candidate) => candidate.groupId,
    ),
    [3, 2, 1],
  );
  assert.equal(families[0]?.groupId, 1, "does not mutate the source array");
});

test("uses first name and registration id as stable tie-breakers", () => {
  const families = [
    family(3, [[30, "Zoe", "Smith"]]),
    family(2, [[20, "Amy", "smith"]]),
    family(1, [[10, "Amy", "Smith"]]),
  ];

  assert.deepEqual(
    sortDeskFamiliesByFirstChildLastName(families).map(
      (candidate) => candidate.groupId,
    ),
    [1, 2, 3],
  );
});
