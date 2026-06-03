import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import {
  db,
  registrationsTable,
  registrationCustomAnswersTable,
  formFieldsTable,
  formsTable,
  eventsTable,
  participantsTable,
  guardiansTable,
  participantGuardiansTable,
  emergencyContactsTable,
  answersTable,
} from "@workspace/db";
import {
  SubmitRegistrationBody,
  SubmitRegistrationParams,
  ListRegistrationsParams,
  GetRegistrationParams,
} from "@workspace/api-zod";

const router = Router();

// ─── System field → DB column mapping ────────────────────────────────────────
// Mirrors the dbColumn values in artifacts/church-checkin/src/lib/systemFields.ts.
// Keys not listed here have dbColumn: null (e.g. photo_permission, authorized_pickup_names)
// and will be saved as custom answers.

type FieldTable = "participants" | "guardians" | "emergency_contacts";

const SYSTEM_KEY_MAP: Record<string, { table: FieldTable; column: string }> = {
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
};

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
      .where(eq(formFieldsTable.formId, formId));

    const fieldById = new Map(formFields.map((f) => [f.id, f]));

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
          // System key with no structured column (photo_permission, authorized_pickup_names, etc.)
          // Save as a custom answer so the data isn't lost
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

    // ── Insert registration ───────────────────────────────────────────────────
    const [registration] = await db
      .insert(registrationsTable)
      .values({
        formId,
        eventId,
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
    const registrations = await db
      .select()
      .from(registrationsTable)
      .where(eq(registrationsTable.formId, formId))
      .orderBy(desc(registrationsTable.createdAt));
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
    const answers = await db
      .select()
      .from(answersTable)
      .where(eq(answersTable.registrationId, registrationId));
    res.json({ ...reg, answers });
  } catch (err) {
    req.log.error({ err }, "Failed to get registration");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
