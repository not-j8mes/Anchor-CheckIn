import { Router } from "express";
import { and, asc, eq } from "drizzle-orm";
import {
  db,
  eventsTable,
  eventStaffMembersTable,
  eventStaffRolesTable,
} from "@workspace/db";
import {
  requireAuthContext,
  requireOrganizationPermission,
} from "../lib/auth";

const router = Router();

function parseId(value: unknown): number | null {
  const id = Number.parseInt(String(value), 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function eventBelongsToOrganization(eventId: number, organizationId: number) {
  const [event] = await db
    .select({ id: eventsTable.id })
    .from(eventsTable)
    .where(
      and(
        eq(eventsTable.id, eventId),
        eq(eventsTable.organizationId, organizationId),
      ),
    )
    .limit(1);
  return Boolean(event);
}

router.get("/events/:eventId/staff", async (req, res) => {
  const eventId = parseId(req.params.eventId);
  const auth = requireAuthContext(req);
  if (!eventId) {
    res.status(400).json({ error: "Invalid eventId" });
    return;
  }
  try {
    if (!(await eventBelongsToOrganization(eventId, auth.organizationId))) {
      res.status(404).json({ error: "Event not found" });
      return;
    }
    const [settings] = await db
      .select({
        showLastName: eventsTable.staffLabelShowLastName,
        showRole: eventsTable.staffLabelShowRole,
        showEventName: eventsTable.staffLabelShowEventName,
        showOrganization: eventsTable.staffLabelShowOrganization,
      })
      .from(eventsTable)
      .where(eq(eventsTable.id, eventId))
      .limit(1);
    const roles = await db
      .select()
      .from(eventStaffRolesTable)
      .where(
        and(
          eq(eventStaffRolesTable.eventId, eventId),
          eq(eventStaffRolesTable.organizationId, auth.organizationId),
        ),
      )
      .orderBy(asc(eventStaffRolesTable.name));
    const members = await db
      .select({
        id: eventStaffMembersTable.id,
        eventId: eventStaffMembersTable.eventId,
        roleId: eventStaffMembersTable.roleId,
        firstName: eventStaffMembersTable.firstName,
        lastName: eventStaffMembersTable.lastName,
        email: eventStaffMembersTable.email,
        phone: eventStaffMembersTable.phone,
        createdAt: eventStaffMembersTable.createdAt,
        roleName: eventStaffRolesTable.name,
      })
      .from(eventStaffMembersTable)
      .innerJoin(
        eventStaffRolesTable,
        eq(eventStaffRolesTable.id, eventStaffMembersTable.roleId),
      )
      .where(
        and(
          eq(eventStaffMembersTable.eventId, eventId),
          eq(eventStaffMembersTable.organizationId, auth.organizationId),
        ),
      )
      .orderBy(
        asc(eventStaffRolesTable.name),
        asc(eventStaffMembersTable.lastName),
        asc(eventStaffMembersTable.firstName),
      );
    res.json({ roles, members, labelSettings: settings });
  } catch (err) {
    req.log.error({ err }, "Failed to list event staff");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put(
  "/events/:eventId/staff/label-settings",
  requireOrganizationPermission("staff"),
  async (req, res) => {
    const eventId = parseId(req.params.eventId);
    const auth = requireAuthContext(req);
    if (!eventId) {
      res.status(400).json({ error: "Invalid eventId" });
      return;
    }
    const booleanValue = (key: string) =>
      typeof req.body?.[key] === "boolean" ? req.body[key] : undefined;
    try {
      const [updated] = await db
        .update(eventsTable)
        .set({
          staffLabelShowLastName: booleanValue("showLastName"),
          staffLabelShowRole: booleanValue("showRole"),
          staffLabelShowEventName: booleanValue("showEventName"),
          staffLabelShowOrganization: booleanValue("showOrganization"),
        })
        .where(
          and(
            eq(eventsTable.id, eventId),
            eq(eventsTable.organizationId, auth.organizationId),
          ),
        )
        .returning({
          showLastName: eventsTable.staffLabelShowLastName,
          showRole: eventsTable.staffLabelShowRole,
          showEventName: eventsTable.staffLabelShowEventName,
          showOrganization: eventsTable.staffLabelShowOrganization,
        });
      if (!updated) {
        res.status(404).json({ error: "Event not found" });
        return;
      }
      res.json(updated);
    } catch (err) {
      req.log.error({ err }, "Failed to update staff label settings");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

router.post(
  "/events/:eventId/staff/roles",
  requireOrganizationPermission("staff"),
  async (req, res) => {
    const eventId = parseId(req.params.eventId);
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const auth = requireAuthContext(req);
    if (!eventId || !name) {
      res.status(400).json({ error: "eventId and name are required" });
      return;
    }
    try {
      if (!(await eventBelongsToOrganization(eventId, auth.organizationId))) {
        res.status(404).json({ error: "Event not found" });
        return;
      }
      const [role] = await db
        .insert(eventStaffRolesTable)
        .values({ eventId, organizationId: auth.organizationId, name })
        .returning();
      res.status(201).json(role);
    } catch (err) {
      req.log.error({ err }, "Failed to create staff role");
      res.status(409).json({ error: "That role already exists" });
    }
  },
);

router.delete(
  "/events/:eventId/staff/roles/:roleId",
  requireOrganizationPermission("staff"),
  async (req, res) => {
    const eventId = parseId(req.params.eventId);
    const roleId = parseId(req.params.roleId);
    const auth = requireAuthContext(req);
    if (!eventId || !roleId) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    try {
      const members = await db
        .select({ id: eventStaffMembersTable.id })
        .from(eventStaffMembersTable)
        .where(eq(eventStaffMembersTable.roleId, roleId))
        .limit(1);
      if (members.length) {
        res.status(409).json({ error: "Remove or reassign staff in this role first" });
        return;
      }
      await db
        .delete(eventStaffRolesTable)
        .where(
          and(
            eq(eventStaffRolesTable.id, roleId),
            eq(eventStaffRolesTable.eventId, eventId),
            eq(eventStaffRolesTable.organizationId, auth.organizationId),
          ),
        );
      res.status(204).send();
    } catch (err) {
      req.log.error({ err }, "Failed to delete staff role");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

router.post(
  "/events/:eventId/staff/members",
  requireOrganizationPermission("staff"),
  async (req, res) => {
    const eventId = parseId(req.params.eventId);
    const roleId = parseId(req.body?.roleId);
    const firstName =
      typeof req.body?.firstName === "string" ? req.body.firstName.trim() : "";
    const lastName =
      typeof req.body?.lastName === "string" ? req.body.lastName.trim() : "";
    const auth = requireAuthContext(req);
    if (!eventId || !roleId || !firstName || !lastName) {
      res.status(400).json({ error: "Name and role are required" });
      return;
    }
    try {
      const [role] = await db
        .select({ id: eventStaffRolesTable.id })
        .from(eventStaffRolesTable)
        .where(
          and(
            eq(eventStaffRolesTable.id, roleId),
            eq(eventStaffRolesTable.eventId, eventId),
            eq(eventStaffRolesTable.organizationId, auth.organizationId),
          ),
        )
        .limit(1);
      if (!role) {
        res.status(400).json({ error: "Invalid staff role" });
        return;
      }
      const [member] = await db
        .insert(eventStaffMembersTable)
        .values({
          eventId,
          organizationId: auth.organizationId,
          roleId,
          firstName,
          lastName,
          email:
            typeof req.body?.email === "string" && req.body.email.trim()
              ? req.body.email.trim()
              : null,
          phone:
            typeof req.body?.phone === "string" && req.body.phone.trim()
              ? req.body.phone.trim()
              : null,
        })
        .returning();
      res.status(201).json(member);
    } catch (err) {
      req.log.error({ err }, "Failed to add staff member");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

router.put(
  "/events/:eventId/staff/members/:memberId",
  requireOrganizationPermission("staff"),
  async (req, res) => {
    const eventId = parseId(req.params.eventId);
    const memberId = parseId(req.params.memberId);
    const roleId = parseId(req.body?.roleId);
    const firstName =
      typeof req.body?.firstName === "string" ? req.body.firstName.trim() : "";
    const lastName =
      typeof req.body?.lastName === "string" ? req.body.lastName.trim() : "";
    const auth = requireAuthContext(req);
    if (!eventId || !memberId || !roleId || !firstName || !lastName) {
      res.status(400).json({ error: "Name and role are required" });
      return;
    }
    try {
      const [role] = await db
        .select({ id: eventStaffRolesTable.id })
        .from(eventStaffRolesTable)
        .where(
          and(
            eq(eventStaffRolesTable.id, roleId),
            eq(eventStaffRolesTable.eventId, eventId),
            eq(eventStaffRolesTable.organizationId, auth.organizationId),
          ),
        )
        .limit(1);
      if (!role) {
        res.status(400).json({ error: "Invalid staff role" });
        return;
      }
      const [member] = await db
        .update(eventStaffMembersTable)
        .set({
          roleId,
          firstName,
          lastName,
          email:
            typeof req.body?.email === "string" && req.body.email.trim()
              ? req.body.email.trim()
              : null,
          phone:
            typeof req.body?.phone === "string" && req.body.phone.trim()
              ? req.body.phone.trim()
              : null,
        })
        .where(
          and(
            eq(eventStaffMembersTable.id, memberId),
            eq(eventStaffMembersTable.eventId, eventId),
            eq(eventStaffMembersTable.organizationId, auth.organizationId),
          ),
        )
        .returning();
      if (!member) {
        res.status(404).json({ error: "Staff member not found" });
        return;
      }
      res.json(member);
    } catch (err) {
      req.log.error({ err }, "Failed to update staff member");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

router.delete(
  "/events/:eventId/staff/members/:memberId",
  requireOrganizationPermission("staff"),
  async (req, res) => {
    const eventId = parseId(req.params.eventId);
    const memberId = parseId(req.params.memberId);
    const auth = requireAuthContext(req);
    if (!eventId || !memberId) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    await db
      .delete(eventStaffMembersTable)
      .where(
        and(
          eq(eventStaffMembersTable.id, memberId),
          eq(eventStaffMembersTable.eventId, eventId),
          eq(eventStaffMembersTable.organizationId, auth.organizationId),
        ),
      );
    res.status(204).send();
  },
);

export default router;
