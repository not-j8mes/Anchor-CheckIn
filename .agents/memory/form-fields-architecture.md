---
name: Form fields architecture
description: New form_fields + participants/guardians tables alongside legacy questions/answers tables.
---

## Schema layout

**New tables (additive — legacy tables kept intact):**
- `form_fields` — replaces `questions` conceptually; has `field_kind` ('system'|'custom') and `system_key`
- `participants` / `guardians` / `participant_guardians` / `emergency_contacts` — structured child+guardian profiles
- `registration_custom_answers` — replaces `answers` for custom field responses

**Legacy tables (kept for backward compat):**
- `questions` — still written/read by all existing routes
- `answers` — still used by registration flow

**Registrations table additions (nullable FKs, backward safe):**
- `event_id`, `participant_id`, `guardian_id`, `submitted_at`

## System key format
Flat snake_case identifiers — e.g. `child_first_name`, `guardian_phone`, `allergies`.
NOT dot-notation like `participant.first_name` (that was the old pre-library format, now migrated away).
The full catalog and dbColumn mappings live in `artifacts/church-checkin/src/lib/systemFields.ts`.

## API behavior
- All form GET endpoints (`/forms/:id`, `/forms/by-slug/:slug`, `/events/:id`) return BOTH `questions` (legacy) and `formFields` (new) arrays.
- New `POST/PUT/DELETE /forms/:formId/fields` routes handle form_fields CRUD.
- `POST /events` seeds both tables when `addDefaultQuestions !== false`.

**Why:** Additive-only migration — existing kiosk check-in and registration flows read from `questions`/`answers`/denormalized `registrations` columns and must not break while the new UI is built on top of `form_fields`.
