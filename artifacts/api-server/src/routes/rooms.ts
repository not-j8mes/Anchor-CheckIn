import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, roomsTable } from "@workspace/db";

const router = Router();

router.get("/rooms", async (req, res) => {
  try {
    const rooms = await db.select().from(roomsTable).orderBy(roomsTable.name);
    res.json(rooms);
  } catch (err) {
    req.log.error({ err }, "Failed to list rooms");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/rooms", async (req, res) => {
  const { name, capacity } = req.body as { name?: string; capacity?: number };
  if (!name?.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  try {
    const [room] = await db
      .insert(roomsTable)
      .values({ name: name.trim(), capacity: capacity ?? null })
      .returning();
    res.status(201).json(room);
  } catch (err) {
    req.log.error({ err }, "Failed to create room");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/rooms/:roomId", async (req, res) => {
  const roomId = parseInt(req.params.roomId, 10);
  if (isNaN(roomId)) { res.status(400).json({ error: "Invalid roomId" }); return; }
  const { name, capacity } = req.body as { name?: string; capacity?: number | null };
  try {
    const [updated] = await db
      .update(roomsTable)
      .set({
        ...(name !== undefined && { name: name.trim() }),
        ...(capacity !== undefined && { capacity }),
      })
      .where(eq(roomsTable.id, roomId))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update room");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/rooms/:roomId", async (req, res) => {
  const roomId = parseInt(req.params.roomId, 10);
  if (isNaN(roomId)) { res.status(400).json({ error: "Invalid roomId" }); return; }
  try {
    await db.delete(roomsTable).where(eq(roomsTable.id, roomId));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete room");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
