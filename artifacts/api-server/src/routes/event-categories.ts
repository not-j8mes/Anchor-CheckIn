import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, eventCategoriesTable, eventsTable } from "@workspace/db";
import { randomBytes } from "crypto";

const router = Router();

const DEFAULT_SLUG = "general";
const DEFAULT_NAME = "General / Other";

/** Seed the default category if it doesn't exist yet. */
async function ensureDefault() {
  const existing = await db
    .select()
    .from(eventCategoriesTable)
    .where(eq(eventCategoriesTable.slug, DEFAULT_SLUG))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(eventCategoriesTable).values({
      slug: DEFAULT_SLUG,
      name: DEFAULT_NAME,
      isDefault: true,
    });
  }
}

router.get("/event-categories", async (req, res) => {
  try {
    await ensureDefault();
    const categories = await db
      .select()
      .from(eventCategoriesTable)
      .orderBy(eventCategoriesTable.name);
    res.json(categories);
  } catch (err) {
    req.log.error({ err }, "Failed to list event categories");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/event-categories", async (req, res) => {
  const { name } = req.body as { name?: string };
  if (!name?.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const trimmedName = name.trim();

  try {
    await ensureDefault();
    const slug = `cat_${randomBytes(4).toString("hex")}`;
    const [category] = await db
      .insert(eventCategoriesTable)
      .values({ slug, name: trimmedName, isDefault: false })
      .returning();
    res.status(201).json(category);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("unique")) {
      res.status(409).json({ error: "A category with that name already exists" });
      return;
    }
    req.log.error({ err }, "Failed to create event category");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/event-categories/:categoryId", async (req, res) => {
  const categoryId = parseInt(req.params.categoryId, 10);
  const { name } = req.body as { name?: string };
  if (!name?.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const trimmedName = name.trim();

  try {
    const [existing] = await db
      .select()
      .from(eventCategoriesTable)
      .where(eq(eventCategoriesTable.id, categoryId))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Category not found" });
      return;
    }

    const [updated] = await db
      .update(eventCategoriesTable)
      .set({ name: trimmedName })
      .where(eq(eventCategoriesTable.id, categoryId))
      .returning();
    res.json(updated);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("unique")) {
      res.status(409).json({ error: "A category with that name already exists" });
      return;
    }
    req.log.error({ err }, "Failed to update event category");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/event-categories/:categoryId", async (req, res) => {
  const categoryId = parseInt(req.params.categoryId, 10);
  try {
    const [existing] = await db
      .select()
      .from(eventCategoriesTable)
      .where(eq(eventCategoriesTable.id, categoryId))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    if (existing.isDefault) {
      res.status(400).json({ error: "The default category cannot be deleted" });
      return;
    }

    // Reassign all events using this category's slug to the default
    await db
      .update(eventsTable)
      .set({ eventType: DEFAULT_SLUG })
      .where(eq(eventsTable.eventType, existing.slug));

    await db
      .delete(eventCategoriesTable)
      .where(eq(eventCategoriesTable.id, categoryId));

    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete event category");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
