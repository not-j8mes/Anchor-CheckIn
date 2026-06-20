import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, organizationsTable } from "@workspace/db";
import { UpdateOrganizationBody } from "@workspace/api-zod";
import { requireOrganizationRole } from "../lib/auth";
import { requireAuthContext } from "../lib/auth";

const router = Router();

router.get("/organizations/current", async (req, res) => {
  try {
    const auth = requireAuthContext(req);
    const [org] = await db
      .select()
      .from(organizationsTable)
      .where(eq(organizationsTable.id, auth.organizationId))
      .limit(1);
    res.json(org);
  } catch (err) {
    req.log.error({ err }, "Failed to get organization");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/organizations/current", requireOrganizationRole("owner", "admin"), async (req, res) => {
  const parsed = UpdateOrganizationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  try {
    const auth = requireAuthContext(req);
    const [updated] = await db
      .update(organizationsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(organizationsTable.id, auth.organizationId))
      .returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update organization");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
