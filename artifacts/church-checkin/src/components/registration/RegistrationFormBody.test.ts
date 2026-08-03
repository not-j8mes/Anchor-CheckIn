import assert from "node:assert/strict";
import test from "node:test";
import type { FormField } from "@workspace/api-client-react";
import { filterFieldsByVisibleSections } from "./RegistrationFormBody";

const field = (
  id: number,
  label: string,
  sectionKey: string | null,
  systemKey: string | null = null,
): FormField =>
  ({
    id,
    formId: 1,
    fieldKind: systemKey ? "system" : "custom",
    systemKey,
    label,
    fieldType: "text",
    required: false,
    sortOrder: id,
    sectionKey,
  }) as FormField;

test("existing-family child-only fields exclude all shared sections", () => {
  const fields = [
    field(1, "Guardian First Name", null, "guardian_first_name"),
    field(2, "Child First Name", null, "child_first_name"),
    field(3, "Favourite Game", "child_info"),
    field(4, "Emergency Contact", null, "emergency_contact_name"),
    field(5, "Family Language", "additional_questions"),
    field(6, "Liability Waiver", "waivers"),
  ];

  assert.deepEqual(
    filterFieldsByVisibleSections(fields, ["child_info"]).map(
      (candidate) => candidate.label,
    ),
    ["Child First Name", "Favourite Game"],
  );
});

test("the standard registration flow leaves every configured field visible", () => {
  const fields = [
    field(1, "Guardian", null, "guardian_first_name"),
    field(2, "Child", null, "child_first_name"),
    field(3, "Emergency", null, "emergency_contact_name"),
  ];
  assert.equal(filterFieldsByVisibleSections(fields), fields);
});
