import { Router } from "express";
import { eq, sql, desc, inArray, asc } from "drizzle-orm";
import { db, eventsTable, formsTable, questionsTable, formFieldsTable, registrationsTable, checkinsTable } from "@workspace/db";
import { randomBytes } from "crypto";

const router = Router();

const DEFAULT_QUESTIONS = [
  { label: "Child's First Name", type: "text", required: true, order: 0, isChildField: true, fieldKey: "childFirstName", placeholder: "Enter first name" },
  { label: "Child's Last Name", type: "text", required: true, order: 1, isChildField: true, fieldKey: "childLastName", placeholder: "Enter last name" },
  { label: "Date of Birth", type: "date", required: true, order: 2, isChildField: true, fieldKey: "childDateOfBirth", placeholder: "" },
  { label: "Parent/Guardian Name", type: "text", required: true, order: 3, isChildField: false, fieldKey: "guardianName", placeholder: "Full name" },
  { label: "Phone Number", type: "phone", required: true, order: 4, isChildField: false, fieldKey: "guardianPhone", placeholder: "(555) 000-0000" },
  { label: "Email Address", type: "email", required: false, order: 5, isChildField: false, fieldKey: "guardianEmail", placeholder: "email@example.com" },
  { label: "Allergies or Medical Notes", type: "textarea", required: false, order: 6, isChildField: true, fieldKey: "allergies", placeholder: "List any allergies or medical conditions..." },
  { label: "Special Needs or Accommodations", type: "textarea", required: false, order: 7, isChildField: true, fieldKey: "specialNeeds", placeholder: "Describe any special needs..." },
];

/**
 * Template: Child Check-In
 * For kids programs — child profiles, guardian info, emergency contacts, safety.
 */
const TEMPLATE_CHILD_CHECKIN = [
  // ── Required ───────────────────────────────────────────────────────────────
  { fieldKind: "system", systemKey: "child_first_name",          label: "Child First Name",                     fieldType: "text",     required: true,  sortOrder: 0,  placeholder: "Enter first name",                              options: null },
  { fieldKind: "system", systemKey: "child_last_name",           label: "Child Last Name",                      fieldType: "text",     required: true,  sortOrder: 1,  placeholder: "Enter last name",                               options: null },
  { fieldKind: "system", systemKey: "date_of_birth",             label: "Date of Birth",                        fieldType: "date",     required: true,  sortOrder: 2,  placeholder: null,                                            options: null },
  { fieldKind: "system", systemKey: "guardian_first_name",       label: "Parent / Guardian First Name",         fieldType: "text",     required: true,  sortOrder: 3,  placeholder: "First name",                                    options: null },
  { fieldKind: "system", systemKey: "guardian_last_name",        label: "Parent / Guardian Last Name",          fieldType: "text",     required: true,  sortOrder: 4,  placeholder: "Last name",                                     options: null },
  { fieldKind: "system", systemKey: "guardian_phone",            label: "Parent / Guardian Phone",              fieldType: "phone",    required: true,  sortOrder: 5,  placeholder: "(555) 000-0000",                                options: null },
  { fieldKind: "system", systemKey: "emergency_contact_name",    label: "Emergency Contact Name",               fieldType: "text",     required: true,  sortOrder: 6,  placeholder: "Full name",                                     options: null },
  { fieldKind: "system", systemKey: "emergency_contact_phone",   label: "Emergency Contact Phone",              fieldType: "phone",    required: true,  sortOrder: 7,  placeholder: "(555) 000-0000",                                options: null },
  // ── Optional ───────────────────────────────────────────────────────────────
  { fieldKind: "system", systemKey: "guardian_email",            label: "Parent / Guardian Email",              fieldType: "email",    required: false, sortOrder: 8,  placeholder: "email@example.com",                             options: null },
  { fieldKind: "system", systemKey: "allergies",                 label: "Allergies",                            fieldType: "textarea", required: false, sortOrder: 9,  placeholder: "List any food, medication, or environmental allergies…", options: null },
  { fieldKind: "system", systemKey: "medical_notes",             label: "Medical Notes",                        fieldType: "textarea", required: false, sortOrder: 10, placeholder: "Any diagnoses, medications, or medical considerations…",  options: null },
  { fieldKind: "system", systemKey: "special_needs",             label: "Special Needs / Accommodations",       fieldType: "textarea", required: false, sortOrder: 11, placeholder: "Describe any special needs or accommodations required…",  options: null },
  { fieldKind: "system", systemKey: "authorized_pickup_names",   label: "Authorized Pickup Names",              fieldType: "textarea", required: false, sortOrder: 12, placeholder: "List everyone authorized to pick up this child…",        options: null },
  { fieldKind: "system", systemKey: "photo_permission",          label: "Photo Permission",                     fieldType: "select",   required: false, sortOrder: 13, placeholder: null,                                            options: "Yes,No" },
  { fieldKind: "system", systemKey: "medical_permission",        label: "Medical Permission",                   fieldType: "select",   required: false, sortOrder: 14, placeholder: null,                                            options: "Yes,No" },
] as const;

/**
 * Template: Family or Group Registration
 * One registrant covers multiple people. allowAdditionalPeople enabled on the form.
 */
const TEMPLATE_FAMILY_GROUP = [
  // ── Required ───────────────────────────────────────────────────────────────
  { fieldKind: "system", systemKey: "participant_first_name",    label: "First Name",                           fieldType: "text",     required: true,  sortOrder: 0,  placeholder: "Enter first name",                              options: null },
  { fieldKind: "system", systemKey: "participant_last_name",     label: "Last Name",                            fieldType: "text",     required: true,  sortOrder: 1,  placeholder: "Enter last name",                               options: null },
  { fieldKind: "system", systemKey: "participant_email",         label: "Email",                                fieldType: "email",    required: true,  sortOrder: 2,  placeholder: "email@example.com",                             options: null },
  { fieldKind: "system", systemKey: "participant_phone",         label: "Phone",                                fieldType: "phone",    required: true,  sortOrder: 3,  placeholder: "(555) 000-0000",                                options: null },
  // ── Optional ───────────────────────────────────────────────────────────────
  { fieldKind: "system", systemKey: "dietary_restrictions",      label: "Dietary Restrictions",                 fieldType: "textarea", required: false, sortOrder: 4,  placeholder: "List any dietary restrictions or food allergies…", options: null },
  { fieldKind: "system", systemKey: "accessibility_needs",       label: "Accessibility Needs",                  fieldType: "textarea", required: false, sortOrder: 5,  placeholder: "Describe any accessibility requirements…",        options: null },
  { fieldKind: "custom", systemKey: null,                        label: "Notes",                                fieldType: "textarea", required: false, sortOrder: 6,  placeholder: "Anything else we should know…",                  options: null },
] as const;

/**
 * Template: Individual Registration
 * Each person registers themselves. Simple signup, no group linking.
 */
const TEMPLATE_INDIVIDUAL = [
  // ── Required ───────────────────────────────────────────────────────────────
  { fieldKind: "system", systemKey: "participant_first_name",    label: "First Name",                           fieldType: "text",     required: true,  sortOrder: 0,  placeholder: "Enter first name",                              options: null },
  { fieldKind: "system", systemKey: "participant_last_name",     label: "Last Name",                            fieldType: "text",     required: true,  sortOrder: 1,  placeholder: "Enter last name",                               options: null },
  { fieldKind: "system", systemKey: "participant_email",         label: "Email",                                fieldType: "email",    required: true,  sortOrder: 2,  placeholder: "email@example.com",                             options: null },
  { fieldKind: "system", systemKey: "participant_phone",         label: "Phone",                                fieldType: "phone",    required: true,  sortOrder: 3,  placeholder: "(555) 000-0000",                                options: null },
  // ── Optional ───────────────────────────────────────────────────────────────
  { fieldKind: "system", systemKey: "dietary_restrictions",      label: "Dietary Restrictions",                 fieldType: "textarea", required: false, sortOrder: 4,  placeholder: "List any dietary restrictions or food allergies…", options: null },
  { fieldKind: "system", systemKey: "accessibility_needs",       label: "Accessibility Needs",                  fieldType: "textarea", required: false, sortOrder: 5,  placeholder: "Describe any accessibility requirements…",        options: null },
] as const;

function getFormTemplate(registrationType?: string | null) {
  if (registrationType === "family_group") return TEMPLATE_FAMILY_GROUP;
  if (registrationType === "individual") return TEMPLATE_INDIVIDUAL;
  return TEMPLATE_CHILD_CHECKIN; // child_checkin or no type
}

async function buildEventRow(event: typeof eventsTable.$inferSelect) {
  let formTitle: string | null = null;
  let formEmbedSlug: string | null = null;
  let registrationCount = 0;

  if (event.formId) {
    const form = await db.select().from(formsTable).where(eq(formsTable.id, event.formId)).limit(1);
    if (form[0]) {
      formTitle = form[0].title;
      formEmbedSlug = form[0].embedSlug;
    }
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(registrationsTable)
      .where(eq(registrationsTable.formId, event.formId));
    registrationCount = count;
  }

  return {
    ...event,
    createdAt: event.createdAt.toISOString(),
    formTitle,
    formEmbedSlug,
    registrationCount,
  };
}

router.get("/events", async (req, res) => {
  try {
    const events = await db.select().from(eventsTable).orderBy(desc(eventsTable.createdAt));
    const rows = await Promise.all(events.map(buildEventRow));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list events");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/events", async (req, res) => {
  const { name, description, eventType, registrationType, startDate, endDate, status, formTitle, formDescription, addDefaultQuestions, trackAttendance, requireCheckout, printLabels, labelType } = req.body;

  if (!name || !eventType || !formTitle) {
    res.status(400).json({ error: "name, eventType, and formTitle are required" });
    return;
  }

  // Smart defaults based on registration type when caller doesn't specify
  const isChildCheckin = !registrationType || registrationType === "child_checkin";
  const resolvedTrackAttendance = trackAttendance !== undefined ? trackAttendance : isChildCheckin;
  const resolvedRequireCheckout = requireCheckout !== undefined ? requireCheckout : isChildCheckin;
  const resolvedPrintLabels = printLabels !== undefined ? printLabels : isChildCheckin;
  const resolvedLabelType = labelType || (resolvedRequireCheckout ? "child_security" : "simple_name");

  try {
    const embedSlug = randomBytes(6).toString("hex");
    const [form] = await db
      .insert(formsTable)
      .values({
        title: formTitle,
        description: formDescription || null,
        isActive: true,
        isPublic: true,
        allowAdditionalPeople: registrationType === "family_group",
        embedSlug,
      })
      .returning();

    if (addDefaultQuestions !== false) {
      // Legacy questions table (backward compat — only seed for child_checkin / no type)
      if (!registrationType || registrationType === "child_checkin") {
        await db.insert(questionsTable).values(
          DEFAULT_QUESTIONS.map((q) => ({ ...q, formId: form.id, options: null }))
        );
      }
      // New form_fields table — use the right template for the registration type
      const template = getFormTemplate(registrationType);
      await db.insert(formFieldsTable).values(
        template.map((f) => ({ ...f, formId: form.id }))
      );
    }

    const [event] = await db
      .insert(eventsTable)
      .values({
        name,
        description: description || null,
        eventType,
        registrationType: registrationType || null,
        startDate: startDate || null,
        endDate: endDate || null,
        status: status || "upcoming",
        formId: form.id,
        trackAttendance: resolvedTrackAttendance,
        requireCheckout: resolvedRequireCheckout,
        printLabels: resolvedPrintLabels,
        labelType: resolvedLabelType,
      })
      .returning();

    const [questions, formFields] = await Promise.all([
      db.select().from(questionsTable).where(eq(questionsTable.formId, form.id)).orderBy(asc(questionsTable.order)),
      db.select().from(formFieldsTable).where(eq(formFieldsTable.formId, form.id)).orderBy(asc(formFieldsTable.sortOrder)),
    ]);

    res.status(201).json({
      ...event,
      createdAt: event.createdAt.toISOString(),
      formTitle: form.title,
      formEmbedSlug: form.embedSlug,
      registrationCount: 0,
      form: { ...form, submissionCount: 0, questions, formFields },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create event");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/events/:eventId/checkins", async (req, res) => {
  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid eventId" }); return; }
  try {
    const event = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
    if (!event[0]) { res.status(404).json({ error: "Not found" }); return; }
    if (!event[0].formId) { res.json([]); return; }

    const regs = await db.select({ id: registrationsTable.id }).from(registrationsTable)
      .where(eq(registrationsTable.formId, event[0].formId));
    if (regs.length === 0) { res.json([]); return; }
    const regIds = regs.map((r) => r.id);
    const checkins = await db.select().from(checkinsTable)
      .where(inArray(checkinsTable.registrationId, regIds))
      .orderBy(desc(checkinsTable.checkinAt));
    res.json(checkins.map((c) => ({
      ...c,
      checkinAt: c.checkinAt.toISOString(),
      checkoutAt: c.checkoutAt?.toISOString() ?? null,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list event checkins");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/events/:eventId", async (req, res) => {
  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) {
    res.status(400).json({ error: "Invalid eventId" });
    return;
  }
  try {
    const event = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
    if (!event[0]) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const row = await buildEventRow(event[0]);

    let form = null;
    if (event[0].formId) {
      const formRow = await db.select().from(formsTable).where(eq(formsTable.id, event[0].formId)).limit(1);
      if (formRow[0]) {
        const [questions, formFields] = await Promise.all([
          db.select().from(questionsTable).where(eq(questionsTable.formId, formRow[0].id)).orderBy(asc(questionsTable.order)),
          db.select().from(formFieldsTable).where(eq(formFieldsTable.formId, formRow[0].id)).orderBy(asc(formFieldsTable.sortOrder)),
        ]);
        form = { ...formRow[0], submissionCount: row.registrationCount, questions, formFields };
      }
    }

    res.json({ ...row, form });
  } catch (err) {
    req.log.error({ err }, "Failed to get event");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/events/:eventId", async (req, res) => {
  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) {
    res.status(400).json({ error: "Invalid eventId" });
    return;
  }
  const { name, description, eventType, registrationType, startDate, endDate, status, trackAttendance, requireCheckout, printLabels, labelType } = req.body;
  try {
    const [updated] = await db
      .update(eventsTable)
      .set({
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(eventType !== undefined && { eventType }),
        ...(registrationType !== undefined && { registrationType }),
        ...(startDate !== undefined && { startDate }),
        ...(endDate !== undefined && { endDate }),
        ...(status !== undefined && { status }),
        ...(trackAttendance !== undefined && { trackAttendance }),
        ...(requireCheckout !== undefined && { requireCheckout }),
        ...(printLabels !== undefined && { printLabels }),
        ...(labelType !== undefined && { labelType }),
      })
      .where(eq(eventsTable.id, eventId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(await buildEventRow(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update event");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/events/:eventId", async (req, res) => {
  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) {
    res.status(400).json({ error: "Invalid eventId" });
    return;
  }
  try {
    // Get the linked formId before deleting the event
    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
    const formId = event?.formId ?? null;

    // Delete the event first (removes FK reference to form)
    await db.delete(eventsTable).where(eq(eventsTable.id, eventId));

    // Then delete the linked form — cascades to questions, registrations, answers, check-ins
    if (formId) {
      await db.delete(formsTable).where(eq(formsTable.id, formId));
    }

    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete event");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
