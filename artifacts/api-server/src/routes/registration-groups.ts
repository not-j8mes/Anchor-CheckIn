import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db, eventsTable, formsTable, registrationGroupsTable } from "@workspace/db";
import { requireAuthContext } from "../lib/auth";

const router = Router();

router.post("/registration-groups", async (req, res) => {
  const { eventId, formId, groupName } = (req.body ?? {}) as {
    eventId?: number;
    formId?: number;
    groupName?: string;
  };
  try {
    const auth = requireAuthContext(req);
    if (eventId) {
      const [event] = await db
        .select({ id: eventsTable.id })
        .from(eventsTable)
        .where(and(eq(eventsTable.id, eventId), eq(eventsTable.organizationId, auth.organizationId)))
        .limit(1);
      if (!event) { res.status(404).json({ error: "Event not found" }); return; }
    }
    if (formId) {
      const [form] = await db
        .select({ id: formsTable.id })
        .from(formsTable)
        .where(and(eq(formsTable.id, formId), eq(formsTable.organizationId, auth.organizationId)))
        .limit(1);
      if (!form) { res.status(404).json({ error: "Form not found" }); return; }
    }
    const [group] = await db
      .insert(registrationGroupsTable)
      .values({
        organizationId: auth.organizationId,
        eventId: eventId ?? null,
        formId: formId ?? null,
        groupName: groupName?.trim() || null,
        submittedAt: new Date(),
      })
      .returning();
    res.status(201).json(group);
  } catch (err) {
    req.log.error({ err }, "Failed to create registration group");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
