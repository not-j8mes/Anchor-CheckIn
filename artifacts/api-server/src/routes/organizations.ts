import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, organizationsTable } from "@workspace/db";
import { UpdateOrganizationBody } from "@workspace/api-zod";

const router = Router();

async function ensureOrg() {
  const existing = await db.select().from(organizationsTable).limit(1);
  if (existing.length === 0) {
    await db.insert(organizationsTable).values({ name: "My Church" });
  }
  return db.select().from(organizationsTable).limit(1).then((r) => r[0]);
}

router.get("/organizations/current", async (req, res) => {
  try {
    const org = await ensureOrg();
    res.json(org);
  } catch (err) {
    req.log.error({ err }, "Failed to get organization");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/organizations/current", async (req, res) => {
  const parsed = UpdateOrganizationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  try {
    const org = await ensureOrg();
    const [updated] = await db
      .update(organizationsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(organizationsTable.id, org.id))
      .returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update organization");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
