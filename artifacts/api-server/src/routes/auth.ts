import { Router } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  organizationMembersTable,
  organizationsTable,
  usersTable,
} from "@workspace/db";
import {
  clearSessionCookie,
  requireAuth,
  serializeAuthContext,
  setSessionCookie,
} from "../lib/auth";
import { verifyPassword } from "../lib/passwords";

const router = Router();

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

router.post("/auth/login", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const [membership] = await db
      .select({
        organizationId: organizationMembersTable.organizationId,
        role: organizationMembersTable.role,
        organizationName: organizationsTable.name,
        subscriptionStatus: organizationsTable.subscriptionStatus,
        plan: organizationsTable.plan,
      })
      .from(organizationMembersTable)
      .innerJoin(
        organizationsTable,
        eq(organizationsTable.id, organizationMembersTable.organizationId),
      )
      .where(eq(organizationMembersTable.userId, user.id))
      .limit(1);

    if (!membership && !user.isSuperAdmin) {
      res.status(403).json({ error: "No organization membership found" });
      return;
    }

    if (membership && !["owner", "admin", "staff"].includes(membership.role)) {
      res.status(403).json({ error: "Invalid organization membership" });
      return;
    }

    setSessionCookie(res, user.id, membership?.organizationId ?? null);
    res.json(
      serializeAuthContext({
        userId: user.id,
        organizationId: membership?.organizationId ?? null,
        role:
          (membership?.role as "owner" | "admin" | "staff" | undefined) ?? null,
        isSuperAdmin: user.isSuperAdmin,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          isSuperAdmin: user.isSuperAdmin,
        },
        organization: membership
          ? {
              id: membership.organizationId,
              name: membership.organizationName,
              subscriptionStatus: membership.subscriptionStatus,
              plan: membership.plan,
            }
          : null,
      }),
    );
  } catch (err) {
    req.log.error({ err }, "Failed to login");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  res.status(204).send();
});

router.get("/auth/me", requireAuth, (req, res) => {
  res.json(serializeAuthContext(req.auth!));
});

export default router;
