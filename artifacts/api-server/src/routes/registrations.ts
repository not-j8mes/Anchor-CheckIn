import { Router } from "express";
import { eq, desc, asc, and, sql } from "drizzle-orm";
import { createHash } from "crypto";
import {
  db,
  registrationsTable,
  registrationCustomAnswersTable,
  formFieldsTable,
  formVersionsTable,
  formVersionFieldsTable,
  formsTable,
  eventsTable,
  participantsTable,
  guardiansTable,
  participantGuardiansTable,
  emergencyContactsTable,
  answersTable,
} from "@workspace/db";
import type { FormField } from "@workspace/db";
import {
  SubmitRegistrationBody,
  SubmitRegistrationParams,
  ListRegistrationsParams,
  GetRegistrationParams,
} from "@workspace/api-zod";

const router = Router();

// ─── System field → DB column mapping ────────────────────────────────────────
// Mirrors the dbColumn values in artifacts/church-checkin/src/lib/systemFields.ts.

type FieldTable = "participants" | "guardians" | "emergency_contacts";

const SYSTEM_KEY_MAP: Record<string, { table: FieldTable; column: string }> = {
  // Child check-in fields
  child_first_name:                { table: "participants",       column: "first_name"    },
  child_last_name:                 { table: "participants",       column: "last_name"     },
  date_of_birth:                   { table: "participants",       column: "date_of_birth" },
  gender:                          { table: "participants",       column: "gender"        },
  grade:                           { table: "participants",       column: "grade"         },
  allergies:                       { table: "participants",       column: "allergies"     },
  medical_notes:                   { table: "participants",       column: "medical_notes" },
  special_needs:                   { table: "participants",       column: "special_needs" },
  notes:                           { table: "participants",       column: "notes"         },
  guardian_first_name:             { table: "guardians",          column: "first_name"    },
  guardian_last_name:              { table: "guardians",          column: "last_name"     },
  guardian_email:                  { table: "guardians",          column: "email"         },
  guardian_phone:                  { table: "guardians",          column: "phone"         },
  emergency_contact_name:          { table: "emergency_contacts", column: "name"          },
  emergency_contact_phone:         { table: "emergency_contacts", column: "phone"         },
  emergency_contact_relationship:  { table: "emergency_contacts", column: "relationship"  },
  // Family / individual registration fields (participant is the registrant)
  participant_first_name:          { table: "participants",       column: "first_name"    },
  participant_last_name:           { table: "participants",       column: "last_name"     },
  participant_email:               { table: "guardians",          column: "email"         },
  participant_phone:               { table: "guardians",          column: "phone"         },
  dietary_restrictions:            { table: "participants",       column: "notes"         },
  accessibility_needs:             { table: "participants",       column: "special_needs" },
};

// ─── Form version helpers ─────────────────────────────────────────────────────

/**
 * Compute a short deterministic hash of the current form_fields set.
 * Two submissions with identical field configurations will produce the same
 * hash, so they share a form_version row.
 */
function computeFieldsHash(fields: FormField[]): string {
  const normalized = [...fields]
    .sort((a, b) => a.id - b.id)
    .map((f) =>
      [
        f.id,
        f.fieldKind,
        f.systemKey ?? "",
        f.label,
        f.fieldType,
        f.required ? "1" : "0",
        f.sortOrder,
        f.options ?? "",
        f.placeholder ?? "",
      ].join(":")
    )
    .join("|");
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

/**
 * Find an existing form_version with the same fields hash, or create a new one.
 * This is idempotent: submitting the same form structure always reuses the same
 * version row.
 */
async function getOrCreateFormVersion(
  formId: number,
  form: { title: string; description: string | null },
  formFields: FormField[]
): Promise<number> {
  const fieldsHash = computeFieldsHash(formFields);

  const [existing] = await db
    .select({ id: formVersionsTable.id })
    .from(formVersionsTable)
    .where(
      and(
        eq(formVersionsTable.formId, formId),
        eq(formVersionsTable.fieldsHash, fieldsHash)
      )
    )
    .limit(1);

  if (existing) return existing.id;

  // Determine the next version number for this form
  const [{ maxVer }] = await db
    .select({ maxVer: sql<number>`COALESCE(MAX(version_number), 0)::int` })
    .from(formVersionsTable)
    .where(eq(formVersionsTable.formId, formId));

  const [newVersion] = await db
    .insert(formVersionsTable)
    .values({
      formId,
      versionNumber: maxVer + 1,
      title: form.title,
      description: form.description ?? null,
      fieldsHash,
    })
    .returning();

  if (formFields.length > 0) {
    await db.insert(formVersionFieldsTable).values(
      formFields.map((f) => ({
        formVersionId: newVersion.id,
        originalFieldId: f.id,
        fieldKind: f.fieldKind,
        systemKey: f.systemKey ?? null,
        label: f.label,
        fieldType: f.fieldType,
        placeholder: f.placeholder ?? null,
        required: f.required,
        sortOrder: f.sortOrder,
        options: f.options ?? null,
      }))
    );
  }

  return newVersion.id;
}

// ─── POST /forms/:formId/register ─────────────────────────────────────────────

router.post("/forms/:formId/register", async (req, res) => {
  const { formId: formIdStr } = SubmitRegistrationParams.parse(req.params);
  const formId = Number(formIdStr);

  const parsed = SubmitRegistrationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }

  const { fields: submittedFields } = parsed.data;

  try {
    // ── Load form ─────────────────────────────────────────────────────────────
    const [form] = await db.select().from(formsTable).where(eq(formsTable.id, formId)).limit(1);
    if (!form) {
      res.status(404).json({ error: "Form not found" });
      return;
    }

    // ── Load the form's event (for eventId FK) ────────────────────────────────
    const [event] = await db
      .select()
      .from(eventsTable)
      .where(eq(eventsTable.formId, formId))
      .limit(1);
    const eventId = event?.id ?? null;

    // ── Load all form_fields for this form ────────────────────────────────────
    const formFields = await db
      .select()
      .from(formFieldsTable)
      .where(eq(formFieldsTable.formId, formId))
      .orderBy(asc(formFieldsTable.sortOrder));

    const fieldById = new Map(formFields.map((f) => [f.id, f]));

    // ── Snapshot: find or create a form version for this field configuration ──
    const formVersionId = await getOrCreateFormVersion(formId, form, formFields);

    // ── Classify each submitted answer ────────────────────────────────────────
    const participantCols: Record<string, string> = {};
    const guardianCols: Record<string, string> = {};
    const emergencyCols: Record<string, string> = {};
    const customAnswers: { formFieldId: number; questionLabel: string; answerValue: string }[] = [];

    for (const { fieldId, value } of submittedFields) {
      if (!value && value !== "false") continue; // skip empties

      const formField = fieldById.get(fieldId);
      if (!formField) continue;

      if (formField.fieldKind === "system" && formField.systemKey) {
        const mapping = SYSTEM_KEY_MAP[formField.systemKey];
        if (mapping) {
          if (mapping.table === "participants") participantCols[mapping.column] = value;
          else if (mapping.table === "guardians") guardianCols[mapping.column] = value;
          else if (mapping.table === "emergency_contacts") emergencyCols[mapping.column] = value;
        } else {
          // System key with no structured column — save as custom answer so data isn't lost
          customAnswers.push({ formFieldId: fieldId, questionLabel: formField.label, answerValue: value });
        }
      } else {
        // Custom question → custom answers table
        customAnswers.push({ formFieldId: fieldId, questionLabel: formField.label, answerValue: value });
      }
    }

    // ── Create participant ────────────────────────────────────────────────────
    const [participant] = await db
      .insert(participantsTable)
      .values({
        firstName: participantCols["first_name"] ?? "",
        lastName:  participantCols["last_name"]  ?? "",
        dateOfBirth:  participantCols["date_of_birth"]  ?? null,
        gender:       participantCols["gender"]          ?? null,
        grade:        participantCols["grade"]           ?? null,
        allergies:    participantCols["allergies"]       ?? null,
        medicalNotes: participantCols["medical_notes"]   ?? null,
        specialNeeds: participantCols["special_needs"]   ?? null,
        notes:        participantCols["notes"]           ?? null,
      })
      .returning();

    // ── Create guardian ───────────────────────────────────────────────────────
    const [guardian] = await db
      .insert(guardiansTable)
      .values({
        firstName: guardianCols["first_name"] ?? "",
        lastName:  guardianCols["last_name"]  ?? "",
        email: guardianCols["email"] ?? null,
        phone: guardianCols["phone"] ?? null,
      })
      .returning();

    // ── Link participant ↔ guardian ───────────────────────────────────────────
    await db.insert(participantGuardiansTable).values({
      participantId: participant.id,
      guardianId:    guardian.id,
      isPrimary:  true,
      canPickUp:  true,
    });

    // ── Create emergency contact (if name provided) ───────────────────────────
    if (emergencyCols["name"]) {
      await db.insert(emergencyContactsTable).values({
        participantId: participant.id,
        name:         emergencyCols["name"],
        phone:        emergencyCols["phone"]         ?? "",
        relationship: emergencyCols["relationship"]  ?? null,
      });
    }

    // ── Build legacy column values for the registrations table ───────────────
    const legacyGuardianName = [guardianCols["first_name"], guardianCols["last_name"]]
      .filter(Boolean)
      .join(" ");

    // ── Insert registration (now includes form_version_id) ────────────────────
    const [registration] = await db
      .insert(registrationsTable)
      .values({
        formId,
        eventId,
        formVersionId,
        participantId: participant.id,
        guardianId:    guardian.id,
        submittedAt:   new Date(),
        // Legacy flat columns — populated from structured data for backward compat
        childFirstName:   participantCols["first_name"]  ?? "",
        childLastName:    participantCols["last_name"]   ?? "",
        childDateOfBirth: participantCols["date_of_birth"] ?? null,
        guardianName:  legacyGuardianName  || "",
        guardianPhone: guardianCols["phone"] ?? "",
        guardianEmail: guardianCols["email"] ?? null,
        allergies:     participantCols["allergies"]    ?? null,
        specialNeeds:  participantCols["special_needs"] ?? null,
      })
      .returning();

    // ── Save custom answers ───────────────────────────────────────────────────
    if (customAnswers.length > 0) {
      await db.insert(registrationCustomAnswersTable).values(
        customAnswers.map((a) => ({
          registrationId: registration.id,
          formFieldId:    a.formFieldId,
          questionLabel:  a.questionLabel,
          answerValue:    a.answerValue,
        }))
      );
    }

    res.status(201).json(registration);
  } catch (err) {
    req.log.error({ err }, "Failed to submit registration");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /forms/:formId/registrations ────────────────────────────────────────

router.get("/forms/:formId/registrations", async (req, res) => {
  const { formId: formIdStr } = ListRegistrationsParams.parse(req.params);
  const formId = Number(formIdStr);
  try {
    const rows = await db
      .select({
        // All registration columns
        id: registrationsTable.id,
        formId: registrationsTable.formId,
        eventId: registrationsTable.eventId,
        participantId: registrationsTable.participantId,
        guardianId: registrationsTable.guardianId,
        registrationGroupId: registrationsTable.registrationGroupId,
        formVersionId: registrationsTable.formVersionId,
        childFirstName: registrationsTable.childFirstName,
        childLastName: registrationsTable.childLastName,
        childDateOfBirth: registrationsTable.childDateOfBirth,
        guardianName: registrationsTable.guardianName,
        guardianPhone: registrationsTable.guardianPhone,
        guardianEmail: registrationsTable.guardianEmail,
        allergies: registrationsTable.allergies,
        specialNeeds: registrationsTable.specialNeeds,
        room: registrationsTable.room,
        createdAt: registrationsTable.createdAt,
        submittedAt: registrationsTable.submittedAt,
        // Participant columns for name fallback
        participantFirstName: participantsTable.firstName,
        participantLastName: participantsTable.lastName,
        // Guardian columns for contact fallback
        guardianFirstNameJoined: guardiansTable.firstName,
        guardianLastNameJoined: guardiansTable.lastName,
        guardianPhoneJoined: guardiansTable.phone,
        guardianEmailJoined: guardiansTable.email,
      })
      .from(registrationsTable)
      .leftJoin(participantsTable, eq(registrationsTable.participantId, participantsTable.id))
      .leftJoin(guardiansTable, eq(registrationsTable.guardianId, guardiansTable.id))
      .where(eq(registrationsTable.formId, formId))
      .orderBy(desc(registrationsTable.createdAt));

    // Overlay participant/guardian data onto the legacy flat columns when the
    // legacy columns are empty (happens for family/individual event types).
    const registrations = rows.map((row) => {
      const firstName = row.childFirstName || row.participantFirstName || "";
      const lastName  = row.childLastName  || row.participantLastName  || "";
      const guardianName = row.guardianName ||
        [row.guardianFirstNameJoined, row.guardianLastNameJoined].filter(Boolean).join(" ");
      const guardianPhone = row.guardianPhone || row.guardianPhoneJoined || "";
      const guardianEmail = row.guardianEmail || row.guardianEmailJoined || null;
      return {
        id: row.id,
        formId: row.formId,
        eventId: row.eventId,
        participantId: row.participantId,
        guardianId: row.guardianId,
        registrationGroupId: row.registrationGroupId,
        formVersionId: row.formVersionId,
        childFirstName: firstName,
        childLastName: lastName,
        childDateOfBirth: row.childDateOfBirth,
        guardianName,
        guardianPhone,
        guardianEmail,
        allergies: row.allergies,
        specialNeeds: row.specialNeeds,
        room: row.room,
        createdAt: row.createdAt,
        submittedAt: row.submittedAt,
      };
    });

    res.json(registrations);
  } catch (err) {
    req.log.error({ err }, "Failed to list registrations");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /registrations/:registrationId ──────────────────────────────────────

router.get("/registrations/:registrationId", async (req, res) => {
  const { registrationId: regIdStr } = GetRegistrationParams.parse(req.params);
  const registrationId = Number(regIdStr);
  try {
    const [reg] = await db
      .select()
      .from(registrationsTable)
      .where(eq(registrationsTable.id, registrationId))
      .limit(1);
    if (!reg) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    // ── Legacy answers (from the old answers table) ───────────────────────────
    const answers = await db
      .select()
      .from(answersTable)
      .where(eq(answersTable.registrationId, registrationId));

    // ── Custom answers, ordered by the snapshot field sort order ─────────────
    let customAnswers: {
      id: number;
      formFieldId: number | null;
      fieldLabel: string;
      value: string;
      sortOrder: number;
    }[];

    if (reg.formVersionId) {
      // Join with form_version_fields to get the sort order from the snapshot
      customAnswers = await db
        .select({
          id: registrationCustomAnswersTable.id,
          formFieldId: registrationCustomAnswersTable.formFieldId,
          fieldLabel: registrationCustomAnswersTable.questionLabel,
          value: registrationCustomAnswersTable.answerValue,
          sortOrder: sql<number>`COALESCE(${formVersionFieldsTable.sortOrder}, 999)::int`,
        })
        .from(registrationCustomAnswersTable)
        .leftJoin(
          formVersionFieldsTable,
          and(
            eq(formVersionFieldsTable.formVersionId, reg.formVersionId),
            eq(
              formVersionFieldsTable.originalFieldId,
              registrationCustomAnswersTable.formFieldId
            )
          )
        )
        .where(eq(registrationCustomAnswersTable.registrationId, registrationId))
        .orderBy(asc(formVersionFieldsTable.sortOrder));
    } else {
      // Legacy: no version — return as-is with a default sort order
      const rows = await db
        .select()
        .from(registrationCustomAnswersTable)
        .where(eq(registrationCustomAnswersTable.registrationId, registrationId));
      customAnswers = rows.map((r, i) => ({
        id: r.id,
        formFieldId: r.formFieldId,
        fieldLabel: r.questionLabel,
        value: r.answerValue,
        sortOrder: i,
      }));
    }

    // ── Load form version with its frozen fields (if available) ───────────────
    let formVersion: {
      id: number;
      formId: number;
      versionNumber: number;
      title: string;
      description: string | null;
      createdAt: Date;
      fields: typeof formVersionFieldsTable.$inferSelect[];
    } | null = null;

    if (reg.formVersionId) {
      const [version] = await db
        .select()
        .from(formVersionsTable)
        .where(eq(formVersionsTable.id, reg.formVersionId))
        .limit(1);

      if (version) {
        const fields = await db
          .select()
          .from(formVersionFieldsTable)
          .where(eq(formVersionFieldsTable.formVersionId, version.id))
          .orderBy(asc(formVersionFieldsTable.sortOrder));

        formVersion = { ...version, fields };
      }
    }

    res.json({ ...reg, formVersion, customAnswers, answers });
  } catch (err) {
    req.log.error({ err }, "Failed to get registration");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── PUT /registrations/:registrationId ──────────────────────────────────────

router.put("/registrations/:registrationId", async (req, res) => {
  const registrationId = parseInt(req.params.registrationId, 10);
  if (isNaN(registrationId)) { res.status(400).json({ error: "Invalid registrationId" }); return; }

  const {
    childFirstName, childLastName, childDateOfBirth,
    guardianFirstName, guardianLastName, guardianPhone, guardianEmail,
    allergies, specialNeeds, room,
  } = req.body as Record<string, string | undefined>;

  try {
    const [reg] = await db
      .select()
      .from(registrationsTable)
      .where(eq(registrationsTable.id, registrationId))
      .limit(1);
    if (!reg) { res.status(404).json({ error: "Not found" }); return; }

    const guardianName = [guardianFirstName, guardianLastName].filter(Boolean).join(" ") || reg.guardianName;

    // Update flat columns on the registration row
    const [updated] = await db
      .update(registrationsTable)
      .set({
        ...(childFirstName !== undefined && { childFirstName }),
        ...(childLastName !== undefined && { childLastName }),
        ...(childDateOfBirth !== undefined && { childDateOfBirth: childDateOfBirth || null }),
        ...(guardianName && { guardianName }),
        ...(guardianPhone !== undefined && { guardianPhone }),
        ...(guardianEmail !== undefined && { guardianEmail: guardianEmail || null }),
        ...(allergies !== undefined && { allergies: allergies || null }),
        ...(specialNeeds !== undefined && { specialNeeds: specialNeeds || null }),
        ...(room !== undefined && { room: room || null }),
      })
      .where(eq(registrationsTable.id, registrationId))
      .returning();

    // Sync participant record
    if (reg.participantId) {
      await db.update(participantsTable).set({
        ...(childFirstName !== undefined && { firstName: childFirstName }),
        ...(childLastName !== undefined && { lastName: childLastName }),
        ...(childDateOfBirth !== undefined && { dateOfBirth: childDateOfBirth || null }),
        ...(allergies !== undefined && { allergies: allergies || null }),
        ...(specialNeeds !== undefined && { specialNeeds: specialNeeds || null }),
      }).where(eq(participantsTable.id, reg.participantId));
    }

    // Sync guardian record
    if (reg.guardianId) {
      await db.update(guardiansTable).set({
        ...(guardianFirstName !== undefined && { firstName: guardianFirstName }),
        ...(guardianLastName !== undefined && { lastName: guardianLastName }),
        ...(guardianPhone !== undefined && { phone: guardianPhone }),
        ...(guardianEmail !== undefined && { email: guardianEmail || null }),
      }).where(eq(guardiansTable.id, reg.guardianId));
    }

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update registration");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
