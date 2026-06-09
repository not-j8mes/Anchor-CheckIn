import { Router } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, roomsTable, registrationsTable, eventsTable } from "@workspace/db";

const router = Router();

router.get("/events/:eventId/rooms", async (req, res) => {
  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid eventId" }); return; }
  try {
    const rooms = await db
      .select({
        id: roomsTable.id,
        eventId: roomsTable.eventId,
        name: roomsTable.name,
        description: roomsTable.description,
        capacity: roomsTable.capacity,
        isActive: roomsTable.isActive,
        sortOrder: roomsTable.sortOrder,
        createdAt: roomsTable.createdAt,
        participantCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${registrationsTable} r
          INNER JOIN ${eventsTable} e ON e.form_id = r.form_id
          WHERE e.id = ${eventId}
            AND r.room = ${roomsTable.name}
        )`,
      })
      .from(roomsTable)
      .where(eq(roomsTable.eventId, eventId))
      .orderBy(roomsTable.sortOrder, roomsTable.name);
    res.json(rooms);
  } catch (err) {
    req.log.error({ err }, "Failed to list rooms");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/events/:eventId/rooms", async (req, res) => {
  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid eventId" }); return; }
  const { name, description, capacity, isActive, sortOrder } = req.body as {
    name?: string;
    description?: string;
    capacity?: number;
    isActive?: boolean;
    sortOrder?: number;
  };
  if (!name?.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  try {
    const [room] = await db
      .insert(roomsTable)
      .values({
        eventId,
        name: name.trim(),
        description: description?.trim() ?? null,
        capacity: capacity ?? null,
        isActive: isActive ?? true,
        sortOrder: sortOrder ?? 0,
      })
      .returning();
    res.status(201).json({ ...room, participantCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to create room");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/events/:eventId/rooms/:roomId", async (req, res) => {
  const eventId = parseInt(req.params.eventId, 10);
  const roomId = parseInt(req.params.roomId, 10);
  if (isNaN(eventId) || isNaN(roomId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { name, description, capacity, isActive, sortOrder } = req.body as {
    name?: string;
    description?: string;
    capacity?: number | null;
    isActive?: boolean;
    sortOrder?: number;
  };
  try {
    const [updated] = await db
      .update(roomsTable)
      .set({
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() ?? null }),
        ...(capacity !== undefined && { capacity }),
        ...(isActive !== undefined && { isActive }),
        ...(sortOrder !== undefined && { sortOrder }),
      })
      .where(and(eq(roomsTable.id, roomId), eq(roomsTable.eventId, eventId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    const [withCount] = await db
      .select({
        id: roomsTable.id,
        eventId: roomsTable.eventId,
        name: roomsTable.name,
        description: roomsTable.description,
        capacity: roomsTable.capacity,
        isActive: roomsTable.isActive,
        sortOrder: roomsTable.sortOrder,
        createdAt: roomsTable.createdAt,
        participantCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${registrationsTable} r
          INNER JOIN ${eventsTable} e ON e.form_id = r.form_id
          WHERE e.id = ${eventId}
            AND r.room = ${roomsTable.name}
        )`,
      })
      .from(roomsTable)
      .where(eq(roomsTable.id, roomId));
    res.json(withCount);
  } catch (err) {
    req.log.error({ err }, "Failed to update room");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/events/:eventId/rooms/:roomId", async (req, res) => {
  const eventId = parseInt(req.params.eventId, 10);
  const roomId = parseInt(req.params.roomId, 10);
  if (isNaN(eventId) || isNaN(roomId)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    await db.delete(roomsTable).where(and(eq(roomsTable.id, roomId), eq(roomsTable.eventId, eventId)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete room");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
