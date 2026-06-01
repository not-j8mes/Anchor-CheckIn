import { Router } from "express";
import { eq, sql, desc } from "drizzle-orm";
import { db, eventsTable, formsTable, questionsTable, registrationsTable } from "@workspace/db";
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
      await db.insert(questionsTable).values(
        DEFAULT_QUESTIONS.map((q) => ({ ...q, formId: form.id, options: null }))
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

    const questions = await db
      .select()
      .from(questionsTable)
      .where(eq(questionsTable.formId, form.id))
      .orderBy(questionsTable.order);

    res.status(201).json({
      ...event,
      createdAt: event.createdAt.toISOString(),
      formTitle: form.title,
      formEmbedSlug: form.embedSlug,
      registrationCount: 0,
      form: { ...form, submissionCount: 0, questions },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create event");
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
        const questions = await db
          .select()
          .from(questionsTable)
          .where(eq(questionsTable.formId, formRow[0].id))
          .orderBy(questionsTable.order);
        form = { ...formRow[0], submissionCount: row.registrationCount, questions };
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
    await db.delete(eventsTable).where(eq(eventsTable.id, eventId));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete event");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
