import { Router } from "express";
import { db, eventsTable, formsTable } from "@workspace/db";

const router = Router();

router.delete("/admin/reset", async (req, res) => {
  try {
    // Delete all events (sets formId to null via onDelete: "set null")
    await db.delete(eventsTable);
    // Delete all forms — cascades to questions, registrations, answers, check-ins
    await db.delete(formsTable);
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to reset all data");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
