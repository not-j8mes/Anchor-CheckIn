import { Router } from "express";
import { eq, asc } from "drizzle-orm";
import { db, formFieldsTable } from "@workspace/db";
import {
  ListFormFieldsParams,
  CreateFormFieldParams,
  CreateFormFieldBody,
  UpdateFormFieldParams,
  UpdateFormFieldBody,
  DeleteFormFieldParams,
  ReorderFormFieldsParams,
  ReorderFormFieldsBody,
} from "@workspace/api-zod";

const router = Router();

router.get("/forms/:formId/fields", async (req, res) => {
  const { formId: formIdStr } = ListFormFieldsParams.parse(req.params);
  const formId = Number(formIdStr);
  try {
    const fields = await db
      .select()
      .from(formFieldsTable)
      .where(eq(formFieldsTable.formId, formId))
      .orderBy(asc(formFieldsTable.sortOrder));
    res.json(fields);
  } catch (err) {
    req.log.error({ err }, "Failed to list form fields");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/forms/:formId/fields", async (req, res) => {
  const { formId: formIdStr } = CreateFormFieldParams.parse(req.params);
  const formId = Number(formIdStr);
  const parsed = CreateFormFieldBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }
  try {
    const [field] = await db
      .insert(formFieldsTable)
      .values({ ...parsed.data, formId })
      .returning();
    res.status(201).json(field);
  } catch (err) {
    req.log.error({ err }, "Failed to create form field");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/forms/:formId/fields/reorder", async (req, res) => {
  const { formId: formIdStr } = ReorderFormFieldsParams.parse(req.params);
  const formId = Number(formIdStr);
  const parsed = ReorderFormFieldsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  try {
    const { fieldIds } = parsed.data;
    for (let i = 0; i < fieldIds.length; i++) {
      await db
        .update(formFieldsTable)
        .set({ sortOrder: i })
        .where(eq(formFieldsTable.id, fieldIds[i]));
    }
    const fields = await db
      .select()
      .from(formFieldsTable)
      .where(eq(formFieldsTable.formId, formId))
      .orderBy(asc(formFieldsTable.sortOrder));
    res.json(fields);
  } catch (err) {
    req.log.error({ err }, "Failed to reorder form fields");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/forms/:formId/fields/:fieldId", async (req, res) => {
  const { fieldId: fieldIdStr } = UpdateFormFieldParams.parse(req.params);
  const fieldId = Number(fieldIdStr);
  const parsed = UpdateFormFieldBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }
  try {
    const [updated] = await db
      .update(formFieldsTable)
      .set(parsed.data)
      .where(eq(formFieldsTable.id, fieldId))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update form field");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/forms/:formId/fields/:fieldId", async (req, res) => {
  const { fieldId: fieldIdStr } = DeleteFormFieldParams.parse(req.params);
  const fieldId = Number(fieldIdStr);
  try {
    await db.delete(formFieldsTable).where(eq(formFieldsTable.id, fieldId));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete form field");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
