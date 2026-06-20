import { Router } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, roomsTable, registrationsTable, eventsTable } from "@workspace/db";
import { requireAuthContext, requireOrganizationRole } from "../lib/auth";

const router = Router();

router.get("/events/:eventId/rooms", async (req, res) => {
  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) {
    res.status(400).json({ error: "Invalid eventId" });
    return;
  }
  try {
    const eventScope = req.auth?.organizationId
      ? and(
          eq(eventsTable.id, eventId),
          eq(eventsTable.organizationId, req.auth.organizationId),
        )
      : eq(eventsTable.id, eventId);
    const [event] = await db
      .select({ id: eventsTable.id })
      .from(eventsTable)
      .where(eventScope)
      .limit(1);
    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return;
    }
    const rooms = await db
      .select({
        id: roomsTable.id,
        eventId: roomsTable.eventId,
        name: roomsTable.name,
        description: roomsTable.description,
        capacity: roomsTable.capacity,
        isActive: roomsTable.isActive,
        sortOrder: roomsTable.sortOrder,
        ageMin: roomsTable.ageMin,
        ageMax: roomsTable.ageMax,
        createdAt: roomsTable.createdAt,
        participantCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${registrationsTable} r
          WHERE r.event_id = ${eventId}
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

router.post("/events/:eventId/rooms", requireOrganizationRole("owner", "admin"), async (req, res) => {
  const eventId = parseInt(String(req.params.eventId), 10);
  if (isNaN(eventId)) {
    res.status(400).json({ error: "Invalid eventId" });
    return;
  }
  const { name, description, capacity, isActive, sortOrder, ageMin, ageMax } =
    req.body as {
      name?: string;
      description?: string;
      capacity?: number;
      isActive?: boolean;
      sortOrder?: number;
      ageMin?: number;
      ageMax?: number;
    };
  if (!name?.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  try {
    const auth = requireAuthContext(req);
    const [event] = await db
      .select({ id: eventsTable.id })
      .from(eventsTable)
      .where(
        and(
          eq(eventsTable.id, eventId),
          eq(eventsTable.organizationId, auth.organizationId),
        ),
      )
      .limit(1);
    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return;
    }
    const [room] = await db
      .insert(roomsTable)
      .values({
        organizationId: auth.organizationId,
        eventId,
        name: name.trim(),
        description: description?.trim() ?? null,
        capacity: capacity ?? null,
        isActive: isActive ?? true,
        sortOrder: sortOrder ?? 0,
        ageMin: ageMin ?? null,
        ageMax: ageMax ?? null,
      })
      .returning();
    res.status(201).json({ ...room, participantCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to create room");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/events/:eventId/rooms/:roomId", requireOrganizationRole("owner", "admin"), async (req, res) => {
  const eventId = parseInt(String(req.params.eventId), 10);
  const roomId = parseInt(String(req.params.roomId), 10);
  if (isNaN(eventId) || isNaN(roomId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const { name, description, capacity, isActive, sortOrder, ageMin, ageMax } =
    req.body as {
      name?: string;
      description?: string;
      capacity?: number | null;
      isActive?: boolean;
      sortOrder?: number;
      ageMin?: number | null;
      ageMax?: number | null;
    };
  try {
    const auth = requireAuthContext(req);
    const [updated] = await db
      .update(roomsTable)
      .set({
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && {
          description: description?.trim() ?? null,
        }),
        ...(capacity !== undefined && { capacity }),
        ...(isActive !== undefined && { isActive }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(ageMin !== undefined && { ageMin }),
        ...(ageMax !== undefined && { ageMax }),
      })
      .where(
        and(
          eq(roomsTable.id, roomId),
          eq(roomsTable.eventId, eventId),
          eq(roomsTable.organizationId, auth.organizationId),
        ),
      )
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [withCount] = await db
      .select({
        id: roomsTable.id,
        eventId: roomsTable.eventId,
        name: roomsTable.name,
        description: roomsTable.description,
        capacity: roomsTable.capacity,
        isActive: roomsTable.isActive,
        sortOrder: roomsTable.sortOrder,
        ageMin: roomsTable.ageMin,
        ageMax: roomsTable.ageMax,
        createdAt: roomsTable.createdAt,
        participantCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${registrationsTable} r
          WHERE r.event_id = ${eventId}
            AND r.room = ${roomsTable.name}
        )`,
      })
      .from(roomsTable)
      .where(
        and(
          eq(roomsTable.id, roomId),
          eq(roomsTable.organizationId, auth.organizationId),
        ),
      );
    res.json(withCount);
  } catch (err) {
    req.log.error({ err }, "Failed to update room");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/events/:eventId/rooms/:roomId", requireOrganizationRole("owner", "admin"), async (req, res) => {
  const eventId = parseInt(String(req.params.eventId), 10);
  const roomId = parseInt(String(req.params.roomId), 10);
  if (isNaN(eventId) || isNaN(roomId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const auth = requireAuthContext(req);
    await db
      .delete(roomsTable)
      .where(
        and(
          eq(roomsTable.id, roomId),
          eq(roomsTable.eventId, eventId),
          eq(roomsTable.organizationId, auth.organizationId),
        ),
      );
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete room");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
