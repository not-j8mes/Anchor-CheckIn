import { Router } from "express";
import { eq, desc, asc, and, sql, isNotNull, inArray } from "drizzle-orm";
import { createHash } from "crypto";
import {
  db,
  registrationsTable,
  registrationCustomAnswersTable,
  registrationGroupsTable,
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
  checkinsTable,
} from "@workspace/db";
import type { FormField } from "@workspace/db";
import {
  SubmitRegistrationBody,
  SubmitRegistrationParams,
  ListRegistrationsParams,
  GetRegistrationParams,
} from "@workspace/api-zod";
import { requireAuthContext } from "../lib/auth";

const router = Router();

class InvalidRegistrationGroupError extends Error {}

// ─── System field → DB column mapping ────────────────────────────────────────
// Mirrors the dbColumn values in artifacts/church-checkin/src/lib/systemFields.ts.

type FieldTable = "participants" | "guardians" | "emergency_contacts" | "registrations";

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
  secondary_guardian_first_name:    { table: "registrations",      column: "secondary_guardian_first_name" },
  secondary_guardian_last_name:     { table: "registrations",      column: "secondary_guardian_last_name"  },
  secondary_guardian_phone:         { table: "registrations",      column: "secondary_guardian_phone"      },
  secondary_guardian_email:         { table: "registrations",      column: "secondary_guardian_email"      },
  secondary_guardian_relationship:  { table: "registrations",      column: "secondary_guardian_relationship" },
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
  database: Pick<typeof db, "select" | "insert">,
  organizationId: number | null,
  formId: number,
  form: { title: string; description: string | null },
  formFields: FormField[]
): Promise<number> {
  const fieldsHash = computeFieldsHash(formFields);

  const [existing] = await database
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
  const [{ maxVer }] = await database
    .select({ maxVer: sql<number>`COALESCE(MAX(version_number), 0)::int` })
    .from(formVersionsTable)
    .where(eq(formVersionsTable.formId, formId));

  const [newVersion] = await database
    .insert(formVersionsTable)
    .values({
      formId,
      organizationId,
      versionNumber: maxVer + 1,
      title: form.title,
      description: form.description ?? null,
      fieldsHash,
    })
    .returning();

  if (formFields.length > 0) {
    await database.insert(formVersionFieldsTable).values(
      formFields.map((f) => ({
        formVersionId: newVersion.id,
        organizationId,
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
  const submittedRoom = (req.body as { room?: string }).room || null;
  const incomingGroupId = (req.body as { registrationGroupId?: number }).registrationGroupId ?? null;

  try {
    // ── Load form ─────────────────────────────────────────────────────────────
    const [form] = await db
      .select()
      .from(formsTable)
      .where(
        and(
          eq(formsTable.id, formId),
          eq(formsTable.isActive, true),
          eq(formsTable.isPublic, true),
        ),
      )
      .limit(1);
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
    const organizationId = form.organizationId ?? event?.organizationId ?? null;

    // ── Load all form_fields for this form ────────────────────────────────────
    const formFields = await db
      .select()
      .from(formFieldsTable)
      .where(eq(formFieldsTable.formId, formId))
      .orderBy(asc(formFieldsTable.sortOrder));

    const fieldById = new Map(formFields.map((f) => [f.id, f]));
    const valueByFieldId = new Map<number, string>();

    for (const { fieldId, value } of submittedFields) {
      const formField = fieldById.get(fieldId);
      if (!formField) {
        res.status(400).json({ error: "Invalid input", details: `Field ${fieldId} does not belong to this form` });
        return;
      }
      valueByFieldId.set(fieldId, value);
    }

    const missingRequiredFields = formFields
      .filter((field) => field.required)
      .filter((field) => !(valueByFieldId.get(field.id) ?? "").trim())
      .map((field) => ({ fieldId: field.id, label: field.label }));

    if (missingRequiredFields.length > 0) {
      res.status(400).json({
        error: "Missing required fields",
        details: missingRequiredFields,
      });
      return;
    }

    // ── Classify each submitted answer ────────────────────────────────────────
    const participantCols: Record<string, string> = {};
    const guardianCols: Record<string, string> = {};
    const emergencyCols: Record<string, string> = {};
    const registrationCols: Record<string, string> = {};
    const customAnswers: { formFieldId: number; questionLabel: string; answerValue: string }[] = [];
    let roomFromFields: string | null = null;

    for (const { fieldId, value } of submittedFields) {
      if (!value && value !== "false") continue; // skip empties

      const formField = fieldById.get(fieldId);
      if (!formField) continue;

      if (formField.fieldKind === "system" && formField.systemKey) {
        // room_assignment maps directly to registrations.room (not to a participant/guardian table)
        if (formField.systemKey === "room_assignment") {
          roomFromFields = value;
          continue;
        }
        const mapping = SYSTEM_KEY_MAP[formField.systemKey];
        if (mapping) {
          if (mapping.table === "participants") participantCols[mapping.column] = value;
          else if (mapping.table === "guardians") guardianCols[mapping.column] = value;
          else if (mapping.table === "emergency_contacts") emergencyCols[mapping.column] = value;
          else if (mapping.table === "registrations") registrationCols[mapping.column] = value;
        } else {
          // System key with no structured column — save as custom answer so data isn't lost
          customAnswers.push({ formFieldId: fieldId, questionLabel: formField.label, answerValue: value });
        }
      } else {
        // Custom question → custom answers table
        customAnswers.push({ formFieldId: fieldId, questionLabel: formField.label, answerValue: value });
      }
    }

    const registration = await db.transaction(async (tx) => {
      // Snapshot creation and every registration write are atomic. Any failure
      // rolls back the participant, guardian, group, registration, and answers.
      const formVersionId = await getOrCreateFormVersion(
        tx,
        organizationId,
        formId,
        form,
        formFields,
      );

    // ── Create participant ────────────────────────────────────────────────────
    const [participant] = await tx
      .insert(participantsTable)
      .values({
        organizationId,
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
    const [guardian] = await tx
      .insert(guardiansTable)
      .values({
        organizationId,
        firstName: guardianCols["first_name"] ?? "",
        lastName:  guardianCols["last_name"]  ?? "",
        email: guardianCols["email"] ?? null,
        phone: guardianCols["phone"] ?? null,
      })
      .returning();

    // ── Link participant ↔ guardian ───────────────────────────────────────────
    await tx.insert(participantGuardiansTable).values({
      organizationId,
      participantId: participant.id,
      guardianId:    guardian.id,
      isPrimary:  true,
      canPickUp:  true,
    });

    // ── Create emergency contact (if name provided) ───────────────────────────
    if (emergencyCols["name"]) {
      await tx.insert(emergencyContactsTable).values({
        organizationId,
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

    // ── Resolve registration group ────────────────────────────────────────────
    // Priority 1: caller supplied a group ID (walk-in multi-child flow)
    // Priority 2: look for an existing group in this event with the same guardian
    //             phone — so public-form submissions from the same family auto-join
    // Priority 3: create a new group
    let registrationGroupId: number;
    if (incomingGroupId) {
      if (!eventId || !organizationId) {
        throw new InvalidRegistrationGroupError();
      }
      const [submittedGroup] = await tx
        .select({ id: registrationGroupsTable.id })
        .from(registrationGroupsTable)
        .where(
          and(
            eq(registrationGroupsTable.id, incomingGroupId),
            eq(registrationGroupsTable.formId, formId),
            eq(registrationGroupsTable.eventId, eventId),
            eq(registrationGroupsTable.organizationId, organizationId),
          ),
        )
        .limit(1);
      if (!submittedGroup) {
        throw new InvalidRegistrationGroupError();
      }
      registrationGroupId = incomingGroupId;
    } else {
      const guardianPhone = guardianCols["phone"] ?? null;
      let foundGroupId: number | null = null;

      if (guardianPhone && eventId) {
        const [existing] = await tx
          .select({ groupId: registrationsTable.registrationGroupId })
          .from(registrationsTable)
          .where(
            and(
              eq(registrationsTable.eventId, eventId),
              eq(registrationsTable.guardianPhone, guardianPhone),
              isNotNull(registrationsTable.registrationGroupId)
            )
          )
          .limit(1);
        foundGroupId = existing?.groupId ?? null;
      }

      if (foundGroupId) {
        registrationGroupId = foundGroupId;
      } else {
        const [newGroup] = await tx
          .insert(registrationGroupsTable)
          .values({ organizationId, eventId, formId, submittedAt: new Date() })
          .returning();
        registrationGroupId = newGroup.id;
      }
    }

    // ── Insert registration (now includes form_version_id) ────────────────────
    const [registration] = await tx
      .insert(registrationsTable)
      .values({
        formId,
        organizationId,
        eventId,
        formVersionId,
        participantId: participant.id,
        guardianId:    guardian.id,
        registrationGroupId,
        submittedAt:   new Date(),
        // Legacy flat columns — populated from structured data for backward compat
        childFirstName:   participantCols["first_name"]  ?? "",
        childLastName:    participantCols["last_name"]   ?? "",
        childDateOfBirth: participantCols["date_of_birth"] ?? null,
        guardianName:  legacyGuardianName  || "",
        guardianPhone: guardianCols["phone"] ?? "",
        guardianEmail: guardianCols["email"] ?? null,
        secondaryGuardianFirstName: registrationCols["secondary_guardian_first_name"] ?? null,
        secondaryGuardianLastName: registrationCols["secondary_guardian_last_name"] ?? null,
        secondaryGuardianPhone: registrationCols["secondary_guardian_phone"] ?? null,
        secondaryGuardianEmail: registrationCols["secondary_guardian_email"] ?? null,
        secondaryGuardianRelationship: registrationCols["secondary_guardian_relationship"] ?? null,
        allergies:     participantCols["allergies"]    ?? null,
        specialNeeds:  participantCols["special_needs"] ?? null,
        room:          roomFromFields ?? submittedRoom,
      })
      .returning();

    // ── Save custom answers ───────────────────────────────────────────────────
    if (customAnswers.length > 0) {
      await tx.insert(registrationCustomAnswersTable).values(
        customAnswers.map((a) => ({
          registrationId: registration.id,
          organizationId,
          formFieldId:    a.formFieldId,
          questionLabel:  a.questionLabel,
          answerValue:    a.answerValue,
        }))
      );
    }

      return registration;
    });

    res.status(201).json(registration);
  } catch (err) {
    if (err instanceof InvalidRegistrationGroupError) {
      res.status(400).json({ error: "Registration group does not belong to this form and event" });
      return;
    }
    req.log.error({ err }, "Failed to submit registration");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /forms/:formId/registrations ────────────────────────────────────────

router.get("/forms/:formId/registrations", async (req, res) => {
  const { formId: formIdStr } = ListRegistrationsParams.parse(req.params);
  const formId = Number(formIdStr);
  try {
    const auth = requireAuthContext(req);
    const [form] = await db
      .select({ id: formsTable.id })
      .from(formsTable)
      .where(and(eq(formsTable.id, formId), eq(formsTable.organizationId, auth.organizationId)))
      .limit(1);
    if (!form) { res.status(404).json({ error: "Form not found" }); return; }

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
        secondaryGuardianFirstName: registrationsTable.secondaryGuardianFirstName,
        secondaryGuardianLastName: registrationsTable.secondaryGuardianLastName,
        secondaryGuardianPhone: registrationsTable.secondaryGuardianPhone,
        secondaryGuardianEmail: registrationsTable.secondaryGuardianEmail,
        secondaryGuardianRelationship: registrationsTable.secondaryGuardianRelationship,
        allergies: registrationsTable.allergies,
        medicalNotes: registrationsTable.medicalNotes,
        specialNeeds: registrationsTable.specialNeeds,
        emergencyContactName: registrationsTable.emergencyContactName,
        emergencyContactPhone: registrationsTable.emergencyContactPhone,
        emergencyContactRelationship: registrationsTable.emergencyContactRelationship,
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
        // Emergency contact fallback from normalized table
        ecName: emergencyContactsTable.name,
        ecPhone: emergencyContactsTable.phone,
        ecRelationship: emergencyContactsTable.relationship,
      })
      .from(registrationsTable)
      .leftJoin(participantsTable, eq(registrationsTable.participantId, participantsTable.id))
      .leftJoin(guardiansTable, eq(registrationsTable.guardianId, guardiansTable.id))
      .leftJoin(emergencyContactsTable, eq(emergencyContactsTable.participantId, registrationsTable.participantId))
      .where(and(eq(registrationsTable.formId, formId), eq(registrationsTable.organizationId, auth.organizationId)))
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
        secondaryGuardianFirstName: row.secondaryGuardianFirstName,
        secondaryGuardianLastName: row.secondaryGuardianLastName,
        secondaryGuardianPhone: row.secondaryGuardianPhone,
        secondaryGuardianEmail: row.secondaryGuardianEmail,
        secondaryGuardianRelationship: row.secondaryGuardianRelationship,
        allergies: row.allergies,
        medicalNotes: row.medicalNotes,
        specialNeeds: row.specialNeeds,
        emergencyContactName: row.emergencyContactName ?? row.ecName ?? null,
        emergencyContactPhone: row.emergencyContactPhone ?? row.ecPhone ?? null,
        emergencyContactRelationship: row.emergencyContactRelationship ?? row.ecRelationship ?? null,
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

// ─── PUT /registration-families ──────────────────────────────────────────────

router.put("/registration-families", async (req, res) => {
  const {
    registrationIds,
    guardianFirstName,
    guardianLastName,
    guardianPhone,
    guardianEmail,
    secondaryGuardianFirstName,
    secondaryGuardianLastName,
    secondaryGuardianPhone,
    secondaryGuardianEmail,
    secondaryGuardianRelationship,
    emergencyContactName,
    emergencyContactPhone,
    emergencyContactRelationship,
  } = req.body as {
    registrationIds?: number[];
    guardianFirstName?: string;
    guardianLastName?: string;
    guardianPhone?: string;
    guardianEmail?: string;
    secondaryGuardianFirstName?: string;
    secondaryGuardianLastName?: string;
    secondaryGuardianPhone?: string;
    secondaryGuardianEmail?: string;
    secondaryGuardianRelationship?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    emergencyContactRelationship?: string;
  };

  const ids = Array.isArray(registrationIds)
    ? registrationIds.filter((id) => Number.isInteger(id) && id > 0)
    : [];

  if (ids.length === 0) {
    res.status(400).json({ error: "registrationIds array required" });
    return;
  }

  const guardianName = [guardianFirstName, guardianLastName].filter(Boolean).join(" ");

  try {
    const auth = requireAuthContext(req);
    const regs = await db
      .select()
      .from(registrationsTable)
      .where(and(inArray(registrationsTable.id, ids), eq(registrationsTable.organizationId, auth.organizationId)));

    if (regs.length === 0) {
      res.status(404).json({ error: "No matching registrations found" });
      return;
    }

    await db
      .update(registrationsTable)
      .set({
        guardianName,
        guardianPhone: guardianPhone ?? "",
        guardianEmail: guardianEmail || null,
        secondaryGuardianFirstName: secondaryGuardianFirstName || null,
        secondaryGuardianLastName: secondaryGuardianLastName || null,
        secondaryGuardianPhone: secondaryGuardianPhone || null,
        secondaryGuardianEmail: secondaryGuardianEmail || null,
        secondaryGuardianRelationship: secondaryGuardianRelationship || null,
        emergencyContactName: emergencyContactName || null,
        emergencyContactPhone: emergencyContactPhone || null,
        emergencyContactRelationship: emergencyContactRelationship || null,
      })
      .where(and(inArray(registrationsTable.id, regs.map((reg) => reg.id)), eq(registrationsTable.organizationId, auth.organizationId)));

    const guardianIds = [...new Set(regs.map((reg) => reg.guardianId).filter((id): id is number => id != null))];
    if (guardianIds.length > 0) {
      await db
        .update(guardiansTable)
        .set({
          firstName: guardianFirstName ?? "",
          lastName: guardianLastName ?? "",
          phone: guardianPhone || null,
          email: guardianEmail || null,
        })
        .where(inArray(guardiansTable.id, guardianIds));
    }

    for (const reg of regs) {
      if (!reg.participantId) continue;

      const [existing] = await db
        .select()
        .from(emergencyContactsTable)
        .where(eq(emergencyContactsTable.participantId, reg.participantId))
        .limit(1);

      if (existing) {
        await db
          .update(emergencyContactsTable)
          .set({
            name: emergencyContactName || existing.name,
            phone: emergencyContactPhone || existing.phone,
            relationship: emergencyContactRelationship || null,
          })
          .where(eq(emergencyContactsTable.id, existing.id));
      } else if (emergencyContactName && emergencyContactPhone) {
        await db.insert(emergencyContactsTable).values({
          participantId: reg.participantId,
          name: emergencyContactName,
          phone: emergencyContactPhone,
          relationship: emergencyContactRelationship || null,
        });
      }
    }

    res.json({ updated: regs.length });
  } catch (err) {
    req.log.error({ err }, "Failed to update registration family");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /registrations/:registrationId ──────────────────────────────────────

router.get("/registrations/:registrationId", async (req, res) => {
  const { registrationId: regIdStr } = GetRegistrationParams.parse(req.params);
  const registrationId = Number(regIdStr);
  try {
    const auth = requireAuthContext(req);
    const [reg] = await db
      .select()
      .from(registrationsTable)
      .where(and(eq(registrationsTable.id, registrationId), eq(registrationsTable.organizationId, auth.organizationId)))
      .limit(1);
    if (!reg) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    // Fallback: populate emergency contact from normalized table if flat columns are missing
    if (reg.participantId && (!reg.emergencyContactName && !reg.emergencyContactPhone)) {
      const [ec] = await db
        .select()
        .from(emergencyContactsTable)
        .where(eq(emergencyContactsTable.participantId, reg.participantId))
        .limit(1);
      if (ec) {
        reg.emergencyContactName = ec.name;
        reg.emergencyContactPhone = ec.phone;
        reg.emergencyContactRelationship = ec.relationship ?? null;
      }
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
    secondaryGuardianFirstName, secondaryGuardianLastName, secondaryGuardianPhone, secondaryGuardianEmail, secondaryGuardianRelationship,
    allergies, medicalNotes, specialNeeds,
    emergencyContactName, emergencyContactPhone, emergencyContactRelationship,
    room,
  } = req.body as Record<string, string | undefined>;

  try {
    const auth = requireAuthContext(req);
    const [reg] = await db
      .select()
      .from(registrationsTable)
      .where(and(eq(registrationsTable.id, registrationId), eq(registrationsTable.organizationId, auth.organizationId)))
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
        ...(secondaryGuardianFirstName !== undefined && { secondaryGuardianFirstName: secondaryGuardianFirstName || null }),
        ...(secondaryGuardianLastName !== undefined && { secondaryGuardianLastName: secondaryGuardianLastName || null }),
        ...(secondaryGuardianPhone !== undefined && { secondaryGuardianPhone: secondaryGuardianPhone || null }),
        ...(secondaryGuardianEmail !== undefined && { secondaryGuardianEmail: secondaryGuardianEmail || null }),
        ...(secondaryGuardianRelationship !== undefined && { secondaryGuardianRelationship: secondaryGuardianRelationship || null }),
        ...(allergies !== undefined && { allergies: allergies || null }),
        ...(medicalNotes !== undefined && { medicalNotes: medicalNotes || null }),
        ...(specialNeeds !== undefined && { specialNeeds: specialNeeds || null }),
        ...(emergencyContactName !== undefined && { emergencyContactName: emergencyContactName || null }),
        ...(emergencyContactPhone !== undefined && { emergencyContactPhone: emergencyContactPhone || null }),
        ...(emergencyContactRelationship !== undefined && { emergencyContactRelationship: emergencyContactRelationship || null }),
        ...(room !== undefined && { room: room || null }),
      })
      .where(and(eq(registrationsTable.id, registrationId), eq(registrationsTable.organizationId, auth.organizationId)))
      .returning();

    // Sync participant record
    if (reg.participantId) {
      await db.update(participantsTable).set({
        ...(childFirstName !== undefined && { firstName: childFirstName }),
        ...(childLastName !== undefined && { lastName: childLastName }),
        ...(childDateOfBirth !== undefined && { dateOfBirth: childDateOfBirth || null }),
        ...(allergies !== undefined && { allergies: allergies || null }),
        ...(medicalNotes !== undefined && { medicalNotes: medicalNotes || null }),
        ...(specialNeeds !== undefined && { specialNeeds: specialNeeds || null }),
      }).where(eq(participantsTable.id, reg.participantId));
    }

    // Sync emergency contact record
    const ecChanged = emergencyContactName !== undefined || emergencyContactPhone !== undefined || emergencyContactRelationship !== undefined;
    if (ecChanged && reg.participantId) {
      const [existing] = await db
        .select()
        .from(emergencyContactsTable)
        .where(eq(emergencyContactsTable.participantId, reg.participantId))
        .limit(1);
      if (existing) {
        await db.update(emergencyContactsTable).set({
          ...(emergencyContactName !== undefined && { name: emergencyContactName || existing.name }),
          ...(emergencyContactPhone !== undefined && { phone: emergencyContactPhone || existing.phone }),
          ...(emergencyContactRelationship !== undefined && { relationship: emergencyContactRelationship || null }),
        }).where(eq(emergencyContactsTable.id, existing.id));
      } else if (emergencyContactName && emergencyContactPhone) {
        await db.insert(emergencyContactsTable).values({
          participantId: reg.participantId,
          name: emergencyContactName,
          phone: emergencyContactPhone,
          relationship: emergencyContactRelationship || null,
        });
      }
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

// ─── PATCH /registrations/:registrationId/custom-answers ─────────────────────

router.patch("/registrations/:registrationId/custom-answers", async (req, res) => {
  const registrationId = parseInt(req.params.registrationId, 10);
  if (isNaN(registrationId)) { res.status(400).json({ error: "Invalid registrationId" }); return; }

  const { answers } = req.body as { answers?: Array<{ id: number; value: string }> };
  if (!Array.isArray(answers)) { res.status(400).json({ error: "answers array required" }); return; }

  try {
    const auth = requireAuthContext(req);
    const [reg] = await db
      .select({ id: registrationsTable.id })
      .from(registrationsTable)
      .where(and(eq(registrationsTable.id, registrationId), eq(registrationsTable.organizationId, auth.organizationId)))
      .limit(1);
    if (!reg) { res.status(404).json({ error: "Not found" }); return; }
    let updated = 0;
    for (const { id, value } of answers) {
      await db
        .update(registrationCustomAnswersTable)
        .set({ answerValue: String(value) })
        .where(and(
          eq(registrationCustomAnswersTable.id, id),
          eq(registrationCustomAnswersTable.registrationId, registrationId),
          eq(registrationCustomAnswersTable.organizationId, auth.organizationId)
        ));
      updated++;
    }
    res.json({ updated });
  } catch (err) {
    req.log.error({ err }, "Failed to update custom answers");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/registrations/:registrationId", async (req, res) => {
  const registrationId = parseInt(req.params.registrationId, 10);
  if (isNaN(registrationId)) { res.status(400).json({ error: "Invalid registrationId" }); return; }
  try {
    const auth = requireAuthContext(req);
    const [reg] = await db
      .select({ id: registrationsTable.id })
      .from(registrationsTable)
      .where(and(eq(registrationsTable.id, registrationId), eq(registrationsTable.organizationId, auth.organizationId)))
      .limit(1);
    if (!reg) { res.status(404).json({ error: "Not found" }); return; }
    // Delete child rows explicitly — avoids relying on DB-level CASCADE being in place
    await db.delete(answersTable).where(eq(answersTable.registrationId, registrationId));
    await db.delete(registrationCustomAnswersTable).where(eq(registrationCustomAnswersTable.registrationId, registrationId));
    await db.delete(checkinsTable).where(eq(checkinsTable.registrationId, registrationId));
    const [deleted] = await db
      .delete(registrationsTable)
      .where(and(eq(registrationsTable.id, registrationId), eq(registrationsTable.organizationId, auth.organizationId)))
      .returning();
    if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete registration");
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.patch("/registrations/:registrationId/room", async (req, res) => {
  const registrationId = parseInt(req.params.registrationId, 10);
  if (isNaN(registrationId)) { res.status(400).json({ error: "Invalid registrationId" }); return; }
  const { room } = req.body as { room?: string | null };
  try {
    const auth = requireAuthContext(req);
    const [updated] = await db
      .update(registrationsTable)
      .set({ room: room || null })
      .where(and(eq(registrationsTable.id, registrationId), eq(registrationsTable.organizationId, auth.organizationId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update registration room");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
