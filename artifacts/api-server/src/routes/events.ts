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
 * Default form_fields seeded for every new event.
 * system_key values are stable identifiers — they match SYSTEM_FIELDS in the
 * frontend's systemFields.ts library and must not change.
 */
const DEFAULT_FORM_FIELDS = [
  { fieldKind: "system", systemKey: "child_first_name",    label: "Child First Name",                    fieldType: "text",     required: true,  sortOrder: 0, placeholder: "Enter first name",                          options: null },
  { fieldKind: "system", systemKey: "child_last_name",     label: "Child Last Name",                     fieldType: "text",     required: true,  sortOrder: 1, placeholder: "Enter last name",                           options: null },
  { fieldKind: "system", systemKey: "date_of_birth",       label: "Date of Birth",                       fieldType: "date",     required: true,  sortOrder: 2, placeholder: null,                                        options: null },
  { fieldKind: "system", systemKey: "guardian_first_name", label: "Parent / Guardian First Name",        fieldType: "text",     required: true,  sortOrder: 3, placeholder: "First name",                                options: null },
  { fieldKind: "system", systemKey: "guardian_phone",      label: "Parent / Guardian Phone",             fieldType: "phone",    required: true,  sortOrder: 4, placeholder: "(555) 000-0000",                            options: null },
  { fieldKind: "system", systemKey: "guardian_email",      label: "Parent / Guardian Email",             fieldType: "email",    required: false, sortOrder: 5, placeholder: "email@example.com",                         options: null },
  { fieldKind: "system", systemKey: "allergies",           label: "Allergies or Medical Notes",          fieldType: "textarea", required: false, sortOrder: 6, placeholder: "List any allergies or medical conditions…",  options: null },
  { fieldKind: "system", systemKey: "special_needs",       label: "Special Needs / Accommodations",      fieldType: "textarea", required: false, sortOrder: 7, placeholder: "Describe any special needs or accommodations…", options: null },
] as const;

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
  const { name, description, eventType, startDate, endDate, status, formTitle, formDescription, addDefaultQuestions } = req.body;

  if (!name || !eventType || !formTitle) {
    res.status(400).json({ error: "name, eventType, and formTitle are required" });
    return;
  }

  try {
    const embedSlug = randomBytes(6).toString("hex");
    const [form] = await db
      .insert(formsTable)
      .values({
        title: formTitle,
        description: formDescription || null,
        isActive: true,
        isPublic: true,
        embedSlug,
      })
      .returning();

    if (addDefaultQuestions !== false) {
      // Legacy questions table (backward compat)
      await db.insert(questionsTable).values(
        DEFAULT_QUESTIONS.map((q) => ({ ...q, formId: form.id, options: null }))
      );
      // New form_fields table
      await db.insert(formFieldsTable).values(
        DEFAULT_FORM_FIELDS.map((f) => ({ ...f, formId: form.id }))
      );
    }

    const [event] = await db
      .insert(eventsTable)
      .values({
        name,
        description: description || null,
        eventType,
        startDate: startDate || null,
        endDate: endDate || null,
        status: status || "upcoming",
        formId: form.id,
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
  const { name, description, eventType, startDate, endDate, status } = req.body;
  try {
    const [updated] = await db
      .update(eventsTable)
      .set({
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(eventType !== undefined && { eventType }),
        ...(startDate !== undefined && { startDate }),
        ...(endDate !== undefined && { endDate }),
        ...(status !== undefined && { status }),
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
