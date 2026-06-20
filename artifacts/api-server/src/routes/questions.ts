import { Router } from "express";
import { and, eq, asc } from "drizzle-orm";
import { db, formsTable, questionsTable } from "@workspace/db";
import {
  CreateQuestionBody,
  CreateQuestionParams,
  UpdateQuestionBody,
  UpdateQuestionParams,
  DeleteQuestionParams,
  ReorderQuestionsBody,
  ReorderQuestionsParams,
  ListQuestionsParams,
} from "@workspace/api-zod";
import { requireAuthContext, requireOrganizationRole } from "../lib/auth";

const router = Router();

router.get("/forms/:formId/questions", async (req, res) => {
  const { formId: formIdStr } = ListQuestionsParams.parse(req.params);
  const formId = Number(formIdStr);
  try {
    const auth = requireAuthContext(req);
    const [form] = await db
      .select({ id: formsTable.id })
      .from(formsTable)
      .where(and(eq(formsTable.id, formId), eq(formsTable.organizationId, auth.organizationId)))
      .limit(1);
    if (!form) { res.status(404).json({ error: "Form not found" }); return; }
    const questions = await db
      .select()
      .from(questionsTable)
      .where(eq(questionsTable.formId, formId))
      .orderBy(asc(questionsTable.order));
    res.json(questions);
  } catch (err) {
    req.log.error({ err }, "Failed to list questions");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/forms/:formId/questions", requireOrganizationRole("owner", "admin"), async (req, res) => {
  const { formId: formIdStr } = CreateQuestionParams.parse(req.params);
  const formId = Number(formIdStr);
  const parsed = CreateQuestionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  try {
    const auth = requireAuthContext(req);
    const [form] = await db
      .select({ id: formsTable.id })
      .from(formsTable)
      .where(and(eq(formsTable.id, formId), eq(formsTable.organizationId, auth.organizationId)))
      .limit(1);
    if (!form) { res.status(404).json({ error: "Form not found" }); return; }
    const [question] = await db
      .insert(questionsTable)
      .values({ ...parsed.data, formId, organizationId: auth.organizationId })
      .returning();
    res.status(201).json(question);
  } catch (err) {
    req.log.error({ err }, "Failed to create question");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/forms/:formId/questions/reorder", requireOrganizationRole("owner", "admin"), async (req, res) => {
  const { formId: formIdStr } = ReorderQuestionsParams.parse(req.params);
  const formId = Number(formIdStr);
  const parsed = ReorderQuestionsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  try {
    const auth = requireAuthContext(req);
    const [form] = await db
      .select({ id: formsTable.id })
      .from(formsTable)
      .where(and(eq(formsTable.id, formId), eq(formsTable.organizationId, auth.organizationId)))
      .limit(1);
    if (!form) { res.status(404).json({ error: "Form not found" }); return; }
    const { questionIds } = parsed.data;
    for (let i = 0; i < questionIds.length; i++) {
      await db
        .update(questionsTable)
        .set({ order: i })
        .where(and(eq(questionsTable.id, questionIds[i]), eq(questionsTable.organizationId, auth.organizationId)));
    }
    const questions = await db
      .select()
      .from(questionsTable)
      .where(eq(questionsTable.formId, formId))
      .orderBy(asc(questionsTable.order));
    res.json(questions);
  } catch (err) {
    req.log.error({ err }, "Failed to reorder questions");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/forms/:formId/questions/:questionId", requireOrganizationRole("owner", "admin"), async (req, res) => {
  const { questionId: questionIdStr } = UpdateQuestionParams.parse(req.params);
  const questionId = Number(questionIdStr);
  const parsed = UpdateQuestionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  try {
    const auth = requireAuthContext(req);
    const [updated] = await db
      .update(questionsTable)
      .set(parsed.data)
      .where(and(eq(questionsTable.id, questionId), eq(questionsTable.organizationId, auth.organizationId)))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update question");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/forms/:formId/questions/:questionId", requireOrganizationRole("owner", "admin"), async (req, res) => {
  const { questionId: questionIdStr } = DeleteQuestionParams.parse(req.params);
  const questionId = Number(questionIdStr);
  try {
    const auth = requireAuthContext(req);
    await db.delete(questionsTable).where(and(eq(questionsTable.id, questionId), eq(questionsTable.organizationId, auth.organizationId)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete question");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
