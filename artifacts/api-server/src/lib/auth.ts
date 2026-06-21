import type { CookieOptions, NextFunction, Request, Response } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { and, eq } from "drizzle-orm";
import {
  db,
  organizationMembersTable,
  organizationsTable,
  usersTable,
} from "@workspace/db";

const COOKIE_NAME = "anchor_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

export interface AuthContext {
  userId: number;
  organizationId: number | null;
  role: "owner" | "admin" | "staff" | null;
  isSuperAdmin: boolean;
  user: {
    id: number;
    firstName: string;
    lastName: string;
    email: string | null;
    username: string | null;
    isSuperAdmin: boolean;
  };
  organization: {
    id: number;
    name: string;
    subscriptionStatus: string;
    plan: string;
  } | null;
}

export interface OrganizationAuthContext extends AuthContext {
  organizationId: number;
  role: "owner" | "admin" | "staff";
  organization: NonNullable<AuthContext["organization"]>;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

interface SessionPayload {
  userId: number;
  organizationId: number | null;
  iat: number;
  exp: number;
}

function getSessionSecret(): string {
  const secret = process.env["SESSION_SECRET"];
  if (!secret) {
    throw new Error("SESSION_SECRET environment variable is required.");
  }
  return secret;
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function sign(value: string): string {
  return createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("base64url");
}

function readCookie(req: Request, name: string): string | undefined {
  const cookie = req.header("cookie");
  if (!cookie) return undefined;

  for (const part of cookie.split(";")) {
    const [rawKey, ...valueParts] = part.trim().split("=");
    if (rawKey === name) return decodeURIComponent(valueParts.join("="));
  }
  return undefined;
}

function isValidSignature(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function createSessionToken(
  userId: number,
  organizationId: number | null,
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    userId,
    organizationId,
    iat: now,
    exp: now + MAX_AGE_SECONDS,
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

function parseSessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;
  if (!isValidSignature(signature, sign(encodedPayload))) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (!payload.userId || !payload.exp) return null;
    if (
      payload.organizationId !== null &&
      !Number.isInteger(payload.organizationId)
    )
      return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function setSessionCookie(
  res: Response,
  userId: number,
  organizationId: number | null,
  staySignedIn = false,
): void {
  const cookieOptions: CookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
  };
  if (staySignedIn) cookieOptions.maxAge = MAX_AGE_SECONDS * 1000;

  res.cookie(
    COOKIE_NAME,
    createSessionToken(userId, organizationId),
    cookieOptions,
  );
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
  });
}

export async function getAuthContext(
  req: Request,
): Promise<AuthContext | null> {
  const payload = parseSessionToken(readCookie(req, COOKIE_NAME));
  if (!payload) return null;

  const [user] = await db
    .select({
      userId: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      email: usersTable.email,
      username: usersTable.username,
      isSuperAdmin: usersTable.isSuperAdmin,
    })
    .from(usersTable)
    .where(eq(usersTable.id, payload.userId))
    .limit(1);

  if (!user) return null;

  const [membership] =
    payload.organizationId === null
      ? []
      : await db
          .select({
            organizationId: organizationsTable.id,
            organizationName: organizationsTable.name,
            subscriptionStatus: organizationsTable.subscriptionStatus,
            plan: organizationsTable.plan,
            role: organizationMembersTable.role,
          })
          .from(organizationMembersTable)
          .innerJoin(
            usersTable,
            eq(usersTable.id, organizationMembersTable.userId),
          )
          .innerJoin(
            organizationsTable,
            eq(organizationsTable.id, organizationMembersTable.organizationId),
          )
          .where(
            and(
              eq(organizationMembersTable.userId, payload.userId),
              eq(
                organizationMembersTable.organizationId,
                payload.organizationId,
              ),
            ),
          )
          .limit(1);

  if (!membership && !user.isSuperAdmin) return null;
  if (membership && !["owner", "admin", "staff"].includes(membership.role))
    return null;

  return {
    userId: user.userId,
    organizationId: membership?.organizationId ?? null,
    role: (membership?.role as AuthContext["role"]) ?? null,
    isSuperAdmin: user.isSuperAdmin,
    user: {
      id: user.userId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      username: user.username,
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
  };
}

export function serializeAuthContext(auth: AuthContext) {
  return {
    user: auth.user,
    organization: auth.organization
      ? {
          ...auth.organization,
          role: auth.role,
        }
      : null,
  };
}

export async function attachAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    req.auth = (await getAuthContext(req)) ?? undefined;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.auth) {
    next();
    return;
  }
  res.status(401).json({ error: "Authentication required" });
}

export function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.auth) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (!req.auth.isSuperAdmin) {
    res.status(403).json({ error: "Super-admin access required" });
    return;
  }
  next();
}

export function requireOrganizationRole(
  ...allowedRoles: Array<NonNullable<AuthContext["role"]>>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!req.auth.organizationId || !req.auth.role) {
      res.status(403).json({ error: "Organization membership required" });
      return;
    }
    if (!allowedRoles.includes(req.auth.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}

export function requireAuthContext(req: Request): OrganizationAuthContext {
  if (!req.auth) throw new Error("Authentication required");
  if (!req.auth.organizationId || !req.auth.organization || !req.auth.role) {
    throw new Error("Organization membership required");
  }
  return req.auth as OrganizationAuthContext;
}
