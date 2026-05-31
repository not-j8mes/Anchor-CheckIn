import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, registrationsTable, answersTable, questionsTable, formsTable } from "@workspace/db";
import {
  SubmitRegistrationBody,
  SubmitRegistrationParams,
  ListRegistrationsParams,
  GetRegistrationParams,
} from "@workspace/api-zod";

const router = Router();

router.post("/forms/:formId/register", async (req, res) => {
  const { formId: formIdStr } = SubmitRegistrationParams.parse(req.params);
  const formId = Number(formIdStr);
  const parsed = SubmitRegistrationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  try {
    const form = await db.select().from(formsTable).where(eq(formsTable.id, formId)).limit(1);
    if (!form[0]) {
      res.status(404).json({ error: "Form not found" });
      return;
    }
    const { answers, ...regData } = parsed.data;
    const [registration] = await db
      .insert(registrationsTable)
      .values({ ...regData, formId })
      .returning();

    if (answers && answers.length > 0) {
      const questions = await db
        .select()
        .from(questionsTable)
        .where(eq(questionsTable.formId, formId));
      const questionMap = new Map(questions.map((q) => [q.id, q.label]));

      await db.insert(answersTable).values(
        answers.map((a) => ({
          registrationId: registration.id,
          questionId: a.questionId,
          questionLabel: questionMap.get(a.questionId) ?? "Unknown",
          value: a.value,
        }))
      );
    }

    res.status(201).json(registration);
  } catch (err) {
    req.log.error({ err }, "Failed to submit registration");
    res.status(500).json({ error: "Internal server error" });
  }
});

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

router.get("/registrations/:registrationId", async (req, res) => {
  const { registrationId: regIdStr } = GetRegistrationParams.parse(req.params);
  const registrationId = Number(regIdStr);
  try {
    const reg = await db
      .select()
      .from(registrationsTable)
      .where(eq(registrationsTable.id, registrationId))
      .limit(1);
    if (!reg[0]) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const answers = await db
      .select()
      .from(answersTable)
      .where(eq(answersTable.registrationId, registrationId));
    res.json({ ...reg[0], answers });
  } catch (err) {
    req.log.error({ err }, "Failed to get registration");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
