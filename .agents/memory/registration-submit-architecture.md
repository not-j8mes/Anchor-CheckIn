---
name: Registration submit architecture
description: How the new field-based registration submission works end-to-end.
---

## Rule
`POST /forms/:formId/register` now accepts `{ fields: [{ fieldId, value }] }` — NOT the old flat `{ childFirstName, guardianName, answers }` payload.

**Why:** System fields must map to structured DB columns (participants, guardians, emergency_contacts). Generic "answers" tables can't represent this cleanly.

## How to apply

### Request format
```json
{ "fields": [{ "fieldId": 1, "value": "Emma" }, { "fieldId": 5, "value": "555-..." }] }
```

### Server-side routing (registrations.ts)
1. Load `form_fields` for the form to get each field's `fieldKind` + `systemKey`.
2. For `fieldKind=system`, look up `systemKey` in `SYSTEM_KEY_MAP` (hardcoded in the route) to find which table+column to write.
3. `participants.*` keys → `participantsTable`; `guardians.*` → `guardiansTable`; `emergency_contacts.*` → `emergencyContactsTable`.
4. System keys with `dbColumn: null` (photo_permission, authorized_pickup_names, etc.) are saved as custom answers.
5. Insert participant → guardian → participant_guardians link → optional emergency_contact → registration.
6. Legacy flat columns on `registrationsTable` (childFirstName, guardianName, etc.) are populated from the structured data for backward compat.
7. Custom question answers go to `registration_custom_answers`.

### Frontend form (register/index.tsx)
- Uses `form.formFields` (not `form.questions`).
- `isGuardianField(field)`: returns true when `systemKey` maps to guardian/emergency_safety category → shown in "Parent/Guardian" section.
- All other fields (participant system fields + custom questions) → per-child section.
- Each child registration submits guardian answers (shared) + its own child answers.

### SYSTEM_KEY_MAP location
Defined inline in `artifacts/api-server/src/routes/registrations.ts`. Mirrors `dbColumn` values from `artifacts/church-checkin/src/lib/systemFields.ts`. If you add a new system field with a real DB column, update BOTH files.
