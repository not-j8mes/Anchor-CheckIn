import { Router } from "express";
import { db, registrationGroupsTable } from "@workspace/db";

const router = Router();

router.post("/registration-groups", async (req, res) => {
  const { eventId, formId, groupName } = (req.body ?? {}) as {
    eventId?: number;
    formId?: number;
    groupName?: string;
  };
  try {
    const [group] = await db
      .insert(registrationGroupsTable)
      .values({
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
