import { Router } from "express";
import { eq, sql, desc, asc } from "drizzle-orm";
import { db, formsTable, questionsTable, formFieldsTable, registrationsTable, eventsTable } from "@workspace/db";
import { CreateFormBody, UpdateFormBody, GetFormParams, UpdateFormParams, DeleteFormParams } from "@workspace/api-zod";
import { randomBytes } from "crypto";

const router = Router();

router.get("/forms", async (req, res) => {
  try {
    const forms = await db.select().from(formsTable).orderBy(desc(formsTable.createdAt));
    const withCounts = await Promise.all(
      forms.map(async (form) => {
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(registrationsTable)
          .where(eq(registrationsTable.formId, form.id));
        return { ...form, submissionCount: count };
      })
    );
    res.json(withCounts);
  } catch (err) {
    req.log.error({ err }, "Failed to list forms");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/forms", async (req, res) => {
  const parsed = CreateFormBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  try {
    const embedSlug = randomBytes(6).toString("hex");
    const [form] = await db
      .insert(formsTable)
      .values({ ...parsed.data, embedSlug })
      .returning();
    res.status(201).json({ ...form, submissionCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to create form");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/forms/by-slug/:embedSlug", async (req, res) => {
  const { embedSlug } = req.params;
  try {
    const form = await db.select().from(formsTable).where(eq(formsTable.embedSlug, embedSlug)).limit(1);
    if (!form[0]) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [questions, formFields, [{ count }], linkedEvent] = await Promise.all([
      db.select().from(questionsTable).where(eq(questionsTable.formId, form[0].id)).orderBy(asc(questionsTable.order)),
      db.select().from(formFieldsTable).where(eq(formFieldsTable.formId, form[0].id)).orderBy(asc(formFieldsTable.sortOrder)),
      db.select({ count: sql<number>`count(*)::int` }).from(registrationsTable).where(eq(registrationsTable.formId, form[0].id)),
      db.select({ registrationType: eventsTable.registrationType, eventId: eventsTable.id, roomAssignmentMode: eventsTable.roomAssignmentMode }).from(eventsTable).where(eq(eventsTable.formId, form[0].id)).limit(1),
    ]);
    const registrationType = linkedEvent[0]?.registrationType ?? null;
    const eventId = linkedEvent[0]?.eventId ?? null;
    const roomAssignmentMode = linkedEvent[0]?.roomAssignmentMode ?? null;
    res.json({ ...form[0], submissionCount: count, questions, formFields, registrationType, eventId, roomAssignmentMode });
  } catch (err) {
    req.log.error({ err }, "Failed to get form by slug");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/forms/:formId", async (req, res) => {
  const { formId: formIdStr } = GetFormParams.parse(req.params);
  const formId = Number(formIdStr);
  try {
    const form = await db.select().from(formsTable).where(eq(formsTable.id, formId)).limit(1);
    if (!form[0]) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [questions, formFields, [{ count }]] = await Promise.all([
      db.select().from(questionsTable).where(eq(questionsTable.formId, formId)).orderBy(asc(questionsTable.order)),
      db.select().from(formFieldsTable).where(eq(formFieldsTable.formId, formId)).orderBy(asc(formFieldsTable.sortOrder)),
      db.select({ count: sql<number>`count(*)::int` }).from(registrationsTable).where(eq(registrationsTable.formId, formId)),
    ]);
    res.json({ ...form[0], submissionCount: count, questions, formFields });
  } catch (err) {
    req.log.error({ err }, "Failed to get form");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/forms/:formId", async (req, res) => {
  const { formId: formIdStr } = UpdateFormParams.parse(req.params);
  const formId = Number(formIdStr);
  const parsed = UpdateFormBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  try {
    const [updated] = await db
      .update(formsTable)
      .set(parsed.data)
      .where(eq(formsTable.id, formId))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ ...updated, submissionCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to update form");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/forms/:formId", async (req, res) => {
  const { formId: formIdStr } = DeleteFormParams.parse(req.params);
  const formId = Number(formIdStr);
  try {
    await db.delete(formsTable).where(eq(formsTable.id, formId));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete form");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
