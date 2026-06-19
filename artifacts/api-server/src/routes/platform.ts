import { Router } from "express";
import { and, count, eq } from "drizzle-orm";
import {
  db,
  organizationMembersTable,
  organizationsTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireSuperAdmin } from "../lib/auth";
import { hashPassword } from "../lib/passwords";

const router = Router();

router.use(requireAuth, requireSuperAdmin);

router.get("/platform/organizations", async (req, res) => {
  try {
    const orgs = await db
      .select({
        id: organizationsTable.id,
        name: organizationsTable.name,
        plan: organizationsTable.plan,
        subscriptionStatus: organizationsTable.subscriptionStatus,
        createdAt: organizationsTable.createdAt,
        userCount: count(organizationMembersTable.userId),
      })
      .from(organizationsTable)
      .leftJoin(
        organizationMembersTable,
        eq(organizationMembersTable.organizationId, organizationsTable.id),
      )
      .groupBy(organizationsTable.id)
      .orderBy(organizationsTable.createdAt);
    res.json(orgs);
  } catch (err) {
    req.log.error({ err }, "Failed to list organizations");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/platform/organizations/:id", async (req, res) => {
  const orgId = parseInt(req.params["id"] ?? "", 10);
  if (isNaN(orgId)) {
    res.status(400).json({ error: "Invalid organization ID" });
    return;
  }
  const body = req.body as Record<string, unknown>;
  const { name, plan, subscriptionStatus } = body;
  const allowedPlans = ["free", "basic", "pro", "custom"];
  const allowedStatuses = ["trialing", "active", "past_due", "canceled", "none"];
  if (plan !== undefined && !allowedPlans.includes(plan as string)) {
    res.status(400).json({ error: "Invalid plan" });
    return;
  }
  if (subscriptionStatus !== undefined && !allowedStatuses.includes(subscriptionStatus as string)) {
    res.status(400).json({ error: "Invalid subscription status" });
    return;
  }
  try {
    const update: Partial<typeof organizationsTable.$inferInsert> & { updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if (typeof name === "string" && name.trim()) update.name = name.trim();
    if (typeof plan === "string") update.plan = plan;
    if (typeof subscriptionStatus === "string") update.subscriptionStatus = subscriptionStatus;
    const [updated] = await db
      .update(organizationsTable)
      .set(update)
      .where(eq(organizationsTable.id, orgId))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update organization");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/platform/organizations", async (req, res) => {
  req.log.info({
    userId: req.auth?.userId,
    email: req.auth?.user?.email,
    isSuperAdmin: req.auth?.isSuperAdmin,
    organizationId: req.auth?.organizationId,
  }, "platform: create organization attempt");
  const body = req.body as Record<string, unknown>;
  const organizationName =
    typeof body["organizationName"] === "string" ? body["organizationName"].trim() : "";
  const ownerFirstName =
    typeof body["ownerFirstName"] === "string" ? body["ownerFirstName"].trim() : "";
  const ownerLastName =
    typeof body["ownerLastName"] === "string" ? body["ownerLastName"].trim() : "";
  const ownerEmail =
    typeof body["ownerEmail"] === "string" ? body["ownerEmail"].trim().toLowerCase() : "";
  const temporaryPassword =
    typeof body["temporaryPassword"] === "string" ? body["temporaryPassword"] : "";
  const plan = typeof body["plan"] === "string" ? body["plan"] : "basic";
  const subscriptionStatus =
    typeof body["subscriptionStatus"] === "string" ? body["subscriptionStatus"] : "trialing";

  if (!organizationName || !ownerFirstName || !ownerLastName || !ownerEmail || !temporaryPassword) {
    res.status(400).json({ error: "All fields are required" });
    return;
  }
  const allowedPlans = ["free", "basic", "pro", "custom"];
  const allowedStatuses = ["trialing", "active", "past_due", "canceled", "none"];
  if (!allowedPlans.includes(plan)) {
    res.status(400).json({ error: "Invalid plan" });
    return;
  }
  if (!allowedStatuses.includes(subscriptionStatus)) {
    res.status(400).json({ error: "Invalid subscription status" });
    return;
  }

  try {
    const [org] = await db
      .insert(organizationsTable)
      .values({ name: organizationName, plan, subscriptionStatus })
      .returning();

    const [existingUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, ownerEmail))
      .limit(1);

    let user = existingUser;
    let userCreated = false;
    if (!user) {
      const [newUser] = await db
        .insert(usersTable)
        .values({
          email: ownerEmail,
          firstName: ownerFirstName,
          lastName: ownerLastName,
          passwordHash: hashPassword(temporaryPassword),
        })
        .returning();
      user = newUser;
      userCreated = true;
    }

    const [existingMembership] = await db
      .select()
      .from(organizationMembersTable)
      .where(
        and(
          eq(organizationMembersTable.userId, user.id),
          eq(organizationMembersTable.organizationId, org.id),
        ),
      )
      .limit(1);

    if (!existingMembership) {
      await db
        .insert(organizationMembersTable)
        .values({ userId: user.id, organizationId: org.id, role: "owner" });
    }

    res.status(201).json({
      organization: { id: org.id, name: org.name },
      user: { id: user.id, email: user.email, created: userCreated },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create organization");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/platform/users", async (req, res) => {
  try {
    const rows = await db
      .select({
        id: usersTable.id,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        email: usersTable.email,
        isSuperAdmin: usersTable.isSuperAdmin,
        createdAt: usersTable.createdAt,
        organizationId: organizationMembersTable.organizationId,
        organizationName: organizationsTable.name,
        role: organizationMembersTable.role,
      })
      .from(usersTable)
      .leftJoin(
        organizationMembersTable,
        eq(organizationMembersTable.userId, usersTable.id),
      )
      .leftJoin(
        organizationsTable,
        eq(organizationsTable.id, organizationMembersTable.organizationId),
      )
      .orderBy(usersTable.createdAt);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list users");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/platform/users", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const rawOrgId = body["organizationId"];
  const organizationId =
    typeof rawOrgId === "number" ? rawOrgId : parseInt(rawOrgId as string, 10);
  const firstName =
    typeof body["firstName"] === "string" ? body["firstName"].trim() : "";
  const lastName =
    typeof body["lastName"] === "string" ? body["lastName"].trim() : "";
  const email =
    typeof body["email"] === "string" ? body["email"].trim().toLowerCase() : "";
  const temporaryPassword =
    typeof body["temporaryPassword"] === "string" ? body["temporaryPassword"] : "";
  const role = typeof body["role"] === "string" ? body["role"] : "staff";

  if (!organizationId || isNaN(organizationId) || !firstName || !lastName || !email || !temporaryPassword) {
    res.status(400).json({ error: "All fields are required" });
    return;
  }
  const allowedRoles = ["owner", "admin", "staff"];
  if (!allowedRoles.includes(role)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }

  try {
    const [org] = await db
      .select()
      .from(organizationsTable)
      .where(eq(organizationsTable.id, organizationId))
      .limit(1);
    if (!org) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    const [existingUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    let user = existingUser;
    let userCreated = false;
    if (!user) {
      const [newUser] = await db
        .insert(usersTable)
        .values({
          email,
          firstName,
          lastName,
          passwordHash: hashPassword(temporaryPassword),
        })
        .returning();
      user = newUser;
      userCreated = true;
    }

    const [existingMembership] = await db
      .select()
      .from(organizationMembersTable)
      .where(
        and(
          eq(organizationMembersTable.userId, user.id),
          eq(organizationMembersTable.organizationId, organizationId),
        ),
      )
      .limit(1);

    let membershipCreated = false;
    if (!existingMembership) {
      await db
        .insert(organizationMembersTable)
        .values({ userId: user.id, organizationId, role });
      membershipCreated = true;
    }

    res.status(201).json({
      user: { id: user.id, email: user.email, created: userCreated },
      membershipCreated,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to add user");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/platform/users/reset-password", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const rawId = body["userId"];
  const userId =
    typeof rawId === "number" ? rawId : parseInt(rawId as string, 10);
  const newPassword =
    typeof body["newPassword"] === "string" ? body["newPassword"] : "";
  if (!userId || isNaN(userId) || !newPassword) {
    res.status(400).json({ error: "userId and newPassword are required" });
    return;
  }

  try {
    const [updated] = await db
      .update(usersTable)
      .set({ passwordHash: hashPassword(newPassword), updatedAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id, email: usersTable.email });
    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ success: true, email: updated.email });
  } catch (err) {
    req.log.error({ err }, "Failed to reset password");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
