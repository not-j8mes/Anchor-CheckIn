import { Router } from "express";
import { and, eq, sql, desc, asc } from "drizzle-orm";
import { db, formsTable, questionsTable, formFieldsTable, registrationsTable, eventsTable, organizationsTable } from "@workspace/db";
import { CreateFormBody, UpdateFormBody, GetFormParams, UpdateFormParams, DeleteFormParams } from "@workspace/api-zod";
import { randomBytes } from "crypto";
import { requireAuthContext, requireOrganizationRole } from "../lib/auth";

const router = Router();

router.get("/forms", async (req, res) => {
  try {
    const auth = requireAuthContext(req);
    const forms = await db
      .select()
      .from(formsTable)
      .where(eq(formsTable.organizationId, auth.organizationId))
      .orderBy(desc(formsTable.createdAt));
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

router.post("/forms", requireOrganizationRole("owner", "admin"), async (req, res) => {
  const parsed = CreateFormBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  try {
    const auth = requireAuthContext(req);
    const embedSlug = randomBytes(6).toString("hex");
    const [form] = await db
      .insert(formsTable)
      .values({ ...parsed.data, organizationId: auth.organizationId, embedSlug })
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
    const form = await db
      .select()
      .from(formsTable)
      .where(
        and(
          eq(formsTable.embedSlug, embedSlug),
          eq(formsTable.isActive, true),
          eq(formsTable.isPublic, true),
        ),
      )
      .limit(1);
    if (!form[0]) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [questions, formFields, linkedEvent, organization] = await Promise.all([
      db.select().from(questionsTable).where(eq(questionsTable.formId, form[0].id)).orderBy(asc(questionsTable.order)),
      db.select().from(formFieldsTable).where(eq(formFieldsTable.formId, form[0].id)).orderBy(asc(formFieldsTable.sortOrder)),
      db.select({ registrationType: eventsTable.registrationType, eventId: eventsTable.id, roomAssignmentMode: eventsTable.roomAssignmentMode }).from(eventsTable).where(eq(eventsTable.formId, form[0].id)).limit(1),
      form[0].organizationId
        ? db
            .select({
              id: organizationsTable.id,
              name: organizationsTable.name,
              logoUrl: organizationsTable.logoUrl,
              headerText: organizationsTable.headerText,
              website: organizationsTable.website,
            })
            .from(organizationsTable)
            .where(eq(organizationsTable.id, form[0].organizationId))
            .limit(1)
        : Promise.resolve([]),
    ]);
    const registrationType = linkedEvent[0]?.registrationType ?? null;
    const eventId = linkedEvent[0]?.eventId ?? null;
    const roomAssignmentMode = linkedEvent[0]?.roomAssignmentMode ?? null;
    res.json({
      id: form[0].id,
      title: form[0].title,
      description: form[0].description,
      isActive: form[0].isActive,
      isPublic: form[0].isPublic,
      allowAdditionalPeople: form[0].allowAdditionalPeople,
      showSectionsOneAtATime: form[0].showSectionsOneAtATime,
      requireStartButton: form[0].requireStartButton,
      allowSecondGuardian: form[0].allowSecondGuardian,
      hideOrgLogo: form[0].hideOrgLogo,
      hideOrgName: form[0].hideOrgName,
      registrationCompleteMessage: form[0].registrationCompleteMessage,
      questions,
      formFields,
      registrationType,
      eventId,
      roomAssignmentMode,
      organization: organization[0] ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get form by slug");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/forms/:formId", async (req, res) => {
  const { formId: formIdStr } = GetFormParams.parse(req.params);
  const formId = Number(formIdStr);
  try {
    const auth = requireAuthContext(req);
    const form = await db
      .select()
      .from(formsTable)
      .where(and(eq(formsTable.id, formId), eq(formsTable.organizationId, auth.organizationId)))
      .limit(1);
    if (!form[0]) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [questions, formFields, [{ count }], linkedEvent] = await Promise.all([
      db.select().from(questionsTable).where(eq(questionsTable.formId, formId)).orderBy(asc(questionsTable.order)),
      db.select().from(formFieldsTable).where(eq(formFieldsTable.formId, formId)).orderBy(asc(formFieldsTable.sortOrder)),
      db.select({ count: sql<number>`count(*)::int` }).from(registrationsTable).where(eq(registrationsTable.formId, formId)),
      db.select({ eventId: eventsTable.id, registrationType: eventsTable.registrationType }).from(eventsTable).where(eq(eventsTable.formId, formId)).limit(1),
    ]);
    const eventId = linkedEvent[0]?.eventId ?? null;
    const registrationType = linkedEvent[0]?.registrationType ?? null;
    res.json({ ...form[0], submissionCount: count, questions, formFields, eventId, registrationType });
  } catch (err) {
    req.log.error({ err }, "Failed to get form");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/forms/:formId", requireOrganizationRole("owner", "admin"), async (req, res) => {
  const { formId: formIdStr } = UpdateFormParams.parse(req.params);
  const formId = Number(formIdStr);
  const parsed = UpdateFormBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  try {
    const auth = requireAuthContext(req);
    const [updated] = await db
      .update(formsTable)
      .set(parsed.data)
      .where(and(eq(formsTable.id, formId), eq(formsTable.organizationId, auth.organizationId)))
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

router.delete("/forms/:formId", requireOrganizationRole("owner", "admin"), async (req, res) => {
  const { formId: formIdStr } = DeleteFormParams.parse(req.params);
  const formId = Number(formIdStr);
  try {
    const auth = requireAuthContext(req);
    await db
      .delete(formsTable)
      .where(and(eq(formsTable.id, formId), eq(formsTable.organizationId, auth.organizationId)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete form");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
