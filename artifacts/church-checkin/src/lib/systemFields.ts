/**
 * Predefined system field library for the form builder.
 *
 * System fields map directly to structured columns in the participants,
 * guardians, and emergency_contacts tables. Their `key` values are stable —
 * they never change even when an admin edits the display label.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export const SYSTEM_FIELD_CATEGORIES = {
  participant: "Child / Participant",
  guardian: "Parent / Guardian",
  emergency_safety: "Emergency / Safety",
} as const;

export type SystemFieldCategory = keyof typeof SYSTEM_FIELD_CATEGORIES;

/**
 * Field types used by system fields.
 * Maps to the `field_type` column in `form_fields` and the OpenAPI enum.
 */
export type SystemFieldType =
  | "text"      // short single-line text
  | "textarea"  // multi-line long text
  | "date"      // date picker
  | "select"    // dropdown / yes-no
  | "email"     // email address
  | "phone";    // phone number

export interface SystemFieldDef {
  /** Stable internal key — stored as `system_key` in `form_fields`. Never changes. */
  key: string;
  /** Default display label. Admins may override this in their form. */
  label: string;
  fieldType: SystemFieldType;
  category: SystemFieldCategory;
  /**
   * Database column this field maps to, in `<table>.<column>` format.
   * `null` means the value is stored as a custom answer with no structured column.
   */
  dbColumn: string | null;
  placeholder?: string;
  /**
   * Default options for `select` fields, as a comma-separated string
   * (matching the `options` column in `form_fields`).
   */
  defaultOptions?: string;
}

// ─── Participant fields ────────────────────────────────────────────────────────

const PARTICIPANT_FIELDS: SystemFieldDef[] = [
  {
    key: "child_first_name",
    label: "Child First Name",
    fieldType: "text",
    category: "participant",
    dbColumn: "participants.first_name",
    placeholder: "Enter first name",
  },
  {
    key: "child_last_name",
    label: "Child Last Name",
    fieldType: "text",
    category: "participant",
    dbColumn: "participants.last_name",
    placeholder: "Enter last name",
  },
  {
    key: "date_of_birth",
    label: "Date of Birth",
    fieldType: "date",
    category: "participant",
    dbColumn: "participants.date_of_birth",
  },
  {
    key: "gender",
    label: "Gender",
    fieldType: "select",
    category: "participant",
    dbColumn: "participants.gender",
    defaultOptions: "Male,Female,Non-binary,Prefer not to say",
  },
  {
    key: "grade",
    label: "Grade",
    fieldType: "text",
    category: "participant",
    dbColumn: "participants.grade",
    placeholder: "e.g. 3rd grade",
  },
  {
    key: "allergies",
    label: "Allergies",
    fieldType: "textarea",
    category: "participant",
    dbColumn: "participants.allergies",
    placeholder: "List any food, medication, or environmental allergies…",
  },
  {
    key: "medical_notes",
    label: "Medical Notes",
    fieldType: "textarea",
    category: "participant",
    dbColumn: "participants.medical_notes",
    placeholder: "Any diagnoses, medications, or medical considerations…",
  },
  {
    key: "special_needs",
    label: "Special Needs / Accommodations",
    fieldType: "textarea",
    category: "participant",
    dbColumn: "participants.special_needs",
    placeholder: "Describe any special needs or accommodations required…",
  },
  {
    key: "notes",
    label: "General Notes",
    fieldType: "textarea",
    category: "participant",
    dbColumn: "participants.notes",
    placeholder: "Any other information we should know…",
  },
];

// ─── Guardian fields ───────────────────────────────────────────────────────────

const GUARDIAN_FIELDS: SystemFieldDef[] = [
  {
    key: "guardian_first_name",
    label: "Parent / Guardian First Name",
    fieldType: "text",
    category: "guardian",
    dbColumn: "guardians.first_name",
    placeholder: "First name",
  },
  {
    key: "guardian_last_name",
    label: "Parent / Guardian Last Name",
    fieldType: "text",
    category: "guardian",
    dbColumn: "guardians.last_name",
    placeholder: "Last name",
  },
  {
    key: "guardian_email",
    label: "Parent / Guardian Email",
    fieldType: "email",
    category: "guardian",
    dbColumn: "guardians.email",
    placeholder: "email@example.com",
  },
  {
    key: "guardian_phone",
    label: "Parent / Guardian Phone",
    fieldType: "phone",
    category: "guardian",
    dbColumn: "guardians.phone",
    placeholder: "(555) 000-0000",
  },
  {
    key: "secondary_guardian_name",
    label: "Secondary Parent / Guardian Name",
    fieldType: "text",
    category: "guardian",
    dbColumn: null,
    placeholder: "Full name",
  },
  {
    key: "secondary_guardian_phone",
    label: "Secondary Parent / Guardian Phone",
    fieldType: "phone",
    category: "guardian",
    dbColumn: null,
    placeholder: "(555) 000-0000",
  },
];

// ─── Emergency / Safety fields ─────────────────────────────────────────────────

const EMERGENCY_SAFETY_FIELDS: SystemFieldDef[] = [
  {
    key: "emergency_contact_name",
    label: "Emergency Contact Name",
    fieldType: "text",
    category: "emergency_safety",
    dbColumn: "emergency_contacts.name",
    placeholder: "Full name",
  },
  {
    key: "emergency_contact_phone",
    label: "Emergency Contact Phone",
    fieldType: "phone",
    category: "emergency_safety",
    dbColumn: "emergency_contacts.phone",
    placeholder: "(555) 000-0000",
  },
  {
    key: "emergency_contact_relationship",
    label: "Emergency Contact Relationship",
    fieldType: "text",
    category: "emergency_safety",
    dbColumn: "emergency_contacts.relationship",
    placeholder: "e.g. Aunt, Neighbor",
  },
  {
    key: "authorized_pickup_names",
    label: "Authorized Pickup Names",
    fieldType: "textarea",
    category: "emergency_safety",
    dbColumn: null,
    placeholder: "List everyone authorized to pick up this child…",
  },
  {
    key: "unauthorized_pickup_notes",
    label: "Unauthorized Pickup Notes",
    fieldType: "textarea",
    category: "emergency_safety",
    dbColumn: null,
    placeholder: "Anyone who is NOT authorized to pick up this child…",
  },
  {
    key: "photo_permission",
    label: "Photo Permission",
    fieldType: "select",
    category: "emergency_safety",
    dbColumn: null,
    defaultOptions: "Yes,No",
    placeholder: undefined,
  },
  {
    key: "medical_permission",
    label: "Medical Permission",
    fieldType: "select",
    category: "emergency_safety",
    dbColumn: null,
    defaultOptions: "Yes,No",
    placeholder: undefined,
  },
];

// ─── Aggregated catalog ────────────────────────────────────────────────────────

/** Full ordered list of all system field definitions. */
export const SYSTEM_FIELDS: SystemFieldDef[] = [
  ...PARTICIPANT_FIELDS,
  ...GUARDIAN_FIELDS,
  ...EMERGENCY_SAFETY_FIELDS,
];

/** Lookup map: system_key → SystemFieldDef */
export const SYSTEM_FIELDS_BY_KEY: ReadonlyMap<string, SystemFieldDef> = new Map(
  SYSTEM_FIELDS.map((f) => [f.key, f])
);

/**
 * Returns the SystemFieldDef for a given system_key, or undefined if not found.
 * Use this when rendering a form_fields row from the DB.
 */
export function getSystemField(key: string): SystemFieldDef | undefined {
  return SYSTEM_FIELDS_BY_KEY.get(key);
}

/**
 * Returns all system fields belonging to a given category.
 */
export function getSystemFieldsByCategory(category: SystemFieldCategory): SystemFieldDef[] {
  return SYSTEM_FIELDS.filter((f) => f.category === category);
}

/**
 * System fields that are added by default when a new event is created.
 * Keys must match entries in SYSTEM_FIELDS.
 */
export const DEFAULT_SYSTEM_FIELD_KEYS: string[] = [
  "child_first_name",
  "child_last_name",
  "date_of_birth",
  "guardian_first_name",
  "guardian_phone",
  "guardian_email",
  "allergies",
  "special_needs",
];
