import { Router } from "express";
import { and, eq, or } from "drizzle-orm";
import { db, organizationMembersTable, organizationsTable, usersTable } from "@workspace/db";
import { UpdateOrganizationBody } from "@workspace/api-zod";
import { requireOrganizationRole } from "../lib/auth";
import { requireAuthContext } from "../lib/auth";
import { hashPassword } from "../lib/passwords";
import { isPgUniqueViolation } from "../lib/httpGuards";

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

router.get("/organizations/current/members", requireOrganizationRole("owner", "admin"), async (req, res) => {
  try {
    const auth = requireAuthContext(req);
    const members = await db
      .select({
        id: organizationMembersTable.id,
        userId: usersTable.id,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        email: usersTable.email,
        username: usersTable.username,
        role: organizationMembersTable.role,
        createdAt: organizationMembersTable.createdAt,
      })
      .from(organizationMembersTable)
      .innerJoin(usersTable, eq(usersTable.id, organizationMembersTable.userId))
      .where(eq(organizationMembersTable.organizationId, auth.organizationId))
      .orderBy(organizationMembersTable.createdAt);
    res.json(members);
  } catch (err) {
    req.log.error({ err }, "Failed to list organization members");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/organizations/current/members", requireOrganizationRole("owner", "admin"), async (req, res) => {
  const auth = requireAuthContext(req);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const role = body["role"] === "admin" ? "admin" : "staff";
  const firstName = typeof body["firstName"] === "string" ? body["firstName"].trim() : "";
  const lastName = typeof body["lastName"] === "string" ? body["lastName"].trim() : "";
  const username = typeof body["username"] === "string" ? body["username"].trim().toLowerCase() : "";
  const email = typeof body["email"] === "string" ? body["email"].trim().toLowerCase() : "";
  const password = typeof body["password"] === "string" ? body["password"] : "";

  if (role === "admin" && auth.role !== "owner") {
    res.status(403).json({ error: "Only an owner can add an administrator" });
    return;
  }
  if (!firstName || password.length < 8) {
    res.status(400).json({ error: "A name and password of at least 8 characters are required" });
    return;
  }
  if (role === "staff" && !/^[a-z0-9._-]{3,32}$/.test(username)) {
    res.status(400).json({ error: "Username must be 3–32 characters using letters, numbers, dots, dashes, or underscores" });
    return;
  }
  if (role === "admin" && (!email || !email.includes("@") || !lastName)) {
    res.status(400).json({ error: "Administrator first name, last name, and email are required" });
    return;
  }

  const identifier = role === "staff" ? username : email;
  try {
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(or(eq(usersTable.email, identifier), eq(usersTable.username, identifier)))
      .limit(1);
    if (existing) {
      res.status(409).json({ error: "That email or username is already in use" });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(usersTable)
        .values({
          firstName,
          lastName: role === "staff" ? lastName : lastName,
          email: role === "admin" ? email : null,
          username: role === "staff" ? username : null,
          passwordHash: hashPassword(password),
        })
        .returning();
      const [membership] = await tx
        .insert(organizationMembersTable)
        .values({ userId: user.id, organizationId: auth.organizationId, role })
        .returning();
      return { user, membership };
    });

    res.status(201).json({
      id: result.membership.id,
      userId: result.user.id,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      email: result.user.email,
      username: result.user.username,
      role,
      createdAt: result.membership.createdAt,
    });
  } catch (err) {
    if (isPgUniqueViolation(err)) {
      res.status(409).json({ error: "That email or username is already in use" });
      return;
    }
    req.log.error({ err }, "Failed to create organization member");
    res.status(500).json({ error: "Internal server error" });
  }
});

async function getManagedMember(memberId: number, organizationId: number) {
  const [member] = await db
    .select({
      id: organizationMembersTable.id,
      userId: organizationMembersTable.userId,
      role: organizationMembersTable.role,
    })
    .from(organizationMembersTable)
    .where(and(
      eq(organizationMembersTable.id, memberId),
      eq(organizationMembersTable.organizationId, organizationId),
    ))
    .limit(1);
  return member;
}

function canManageMember(auth: ReturnType<typeof requireAuthContext>, member: { userId: number; role: string }): boolean {
  if (member.userId === auth.userId || member.role === "owner") return false;
  return auth.role === "owner" || member.role === "staff";
}

router.put("/organizations/current/members/:memberId/password", requireOrganizationRole("owner", "admin"), async (req, res) => {
  const memberId = Number(req.params["memberId"]);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const username = typeof req.body?.username === "string" ? req.body.username.trim().toLowerCase() : "";
  if (!Number.isInteger(memberId) || (!username && !password)) {
    res.status(400).json({ error: "A username or new password is required" });
    return;
  }
  if (password && password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }
  if (username && !/^[a-z0-9._-]{3,32}$/.test(username)) {
    res.status(400).json({ error: "Username must be 3–32 characters using letters, numbers, dots, dashes, or underscores" });
    return;
  }
  try {
    const auth = requireAuthContext(req);
    const member = await getManagedMember(memberId, auth.organizationId);
    if (!member) { res.status(404).json({ error: "Member not found" }); return; }
    if (!canManageMember(auth, member)) { res.status(403).json({ error: "You cannot reset this member's password" }); return; }
    if (username && member.role !== "staff") { res.status(400).json({ error: "Only staff usernames can be changed" }); return; }
    if (username) {
      const [existing] = await db.select({ id: usersTable.id }).from(usersTable)
        .where(or(eq(usersTable.email, username), eq(usersTable.username, username))).limit(1);
      if (existing && existing.id !== member.userId) { res.status(409).json({ error: "That username is already in use" }); return; }
    }
    await db.update(usersTable)
      .set({
        username: username || undefined,
        passwordHash: password ? hashPassword(password) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, member.userId));
    res.json({ success: true, username: username || undefined });
  } catch (err) {
    if (isPgUniqueViolation(err)) { res.status(409).json({ error: "That username is already in use" }); return; }
    req.log.error({ err }, "Failed to reset organization member password");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/organizations/current/members/:memberId", requireOrganizationRole("owner", "admin"), async (req, res) => {
  const memberId = Number(req.params["memberId"]);
  if (!Number.isInteger(memberId)) { res.status(400).json({ error: "Invalid member" }); return; }
  try {
    const auth = requireAuthContext(req);
    const member = await getManagedMember(memberId, auth.organizationId);
    if (!member) { res.status(404).json({ error: "Member not found" }); return; }
    if (!canManageMember(auth, member)) { res.status(403).json({ error: "You cannot remove this member" }); return; }
    await db.transaction(async (tx) => {
      await tx.delete(organizationMembersTable).where(eq(organizationMembersTable.id, member.id));
      const [remainingMembership] = await tx
        .select({ id: organizationMembersTable.id })
        .from(organizationMembersTable)
        .where(eq(organizationMembersTable.userId, member.userId))
        .limit(1);
      if (!remainingMembership) {
        await tx.delete(usersTable).where(and(eq(usersTable.id, member.userId), eq(usersTable.isSuperAdmin, false)));
      }
    });
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to remove organization member");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
