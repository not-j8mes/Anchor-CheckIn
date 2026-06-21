import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { NextFunction, Request, Response } from "express";
import type { AuthContext } from "./auth";

process.env["DATABASE_URL"] ??= "postgresql://localhost:5432/anchor_checkin";
process.env["SESSION_SECRET"] ??= "test-session-secret";
let requireSuperAdmin: (typeof import("./auth"))["requireSuperAdmin"];
let requireOrganizationRole: (typeof import("./auth"))["requireOrganizationRole"];
let setSessionCookie: (typeof import("./auth"))["setSessionCookie"];
let pool: (typeof import("@workspace/db"))["pool"];

before(async () => {
  const [authModule, dbModule] = await Promise.all([
    import("./auth"),
    import("@workspace/db"),
  ]);
  requireSuperAdmin = authModule.requireSuperAdmin;
  requireOrganizationRole = authModule.requireOrganizationRole;
  setSessionCookie = authModule.setSessionCookie;
  pool = dbModule.pool;
});

after(async () => {
  await pool.end();
});

function authContext(
  isSuperAdmin: boolean,
  role: AuthContext["role"] = null,
): AuthContext {
  const organization = role
    ? { id: 10, name: "Test Org", subscriptionStatus: "active", plan: "basic" }
    : null;
  return {
    userId: 1,
    organizationId: organization?.id ?? null,
    role,
    isSuperAdmin,
    user: {
      id: 1,
      firstName: "Test",
      lastName: "User",
      email: "test@example.com",
      username: null,
      isSuperAdmin,
    },
    organization,
  };
}

function responseRecorder() {
  const result = { statusCode: 200, body: undefined as unknown };
  const response = {
    status(code: number) {
      result.statusCode = code;
      return response;
    },
    json(body: unknown) {
      result.body = body;
      return response;
    },
  } as unknown as Response;
  return { response, result };
}

describe("requireSuperAdmin", () => {
  it("returns 401 when the request is unauthenticated", () => {
    const { response, result } = responseRecorder();
    let called = false;
    requireSuperAdmin({} as Request, response, (() => {
      called = true;
    }) as NextFunction);
    assert.equal(result.statusCode, 401);
    assert.equal(called, false);
  });

  it("returns 403 for a normal authenticated user", () => {
    const { response, result } = responseRecorder();
    let called = false;
    requireSuperAdmin(
      { auth: authContext(false) } as Request,
      response,
      (() => {
        called = true;
      }) as NextFunction,
    );
    assert.equal(result.statusCode, 403);
    assert.equal(called, false);
  });

  it("allows an authenticated super admin", () => {
    const { response } = responseRecorder();
    let called = false;
    requireSuperAdmin({ auth: authContext(true) } as Request, response, (() => {
      called = true;
    }) as NextFunction);
    assert.equal(called, true);
  });
});

describe("requireOrganizationRole", () => {
  const requireManager = () => requireOrganizationRole("owner", "admin");

  it("allows owners and admins", () => {
    for (const role of ["owner", "admin"] as const) {
      const { response } = responseRecorder();
      let called = false;
      requireManager()(
        { auth: authContext(false, role) } as Request,
        response,
        (() => { called = true; }) as NextFunction,
      );
      assert.equal(called, true);
    }
  });

  it("rejects staff users", () => {
    const { response, result } = responseRecorder();
    let called = false;
    requireManager()(
      { auth: authContext(false, "staff") } as Request,
      response,
      (() => { called = true; }) as NextFunction,
    );
    assert.equal(result.statusCode, 403);
    assert.equal(called, false);
  });

  it("rejects users without an organization membership", () => {
    const { response, result } = responseRecorder();
    requireManager()(
      { auth: authContext(true) } as Request,
      response,
      (() => assert.fail("middleware should not continue")) as NextFunction,
    );
    assert.equal(result.statusCode, 403);
  });
});

describe("setSessionCookie", () => {
  function recordCookie(staySignedIn: boolean) {
    let options: Record<string, unknown> | undefined;
    const response = {
      cookie(_name: string, _value: string, cookieOptions: Record<string, unknown>) {
        options = cookieOptions;
      },
    } as unknown as Response;

    setSessionCookie(response, 1, 10, staySignedIn);
    return options;
  }

  it("creates a browser-session cookie by default", () => {
    const options = recordCookie(false);
    assert.ok(options);
    assert.equal("maxAge" in options, false);
  });

  it("creates a 14-day persistent cookie when requested", () => {
    const options = recordCookie(true);
    assert.ok(options);
    assert.equal(options.maxAge, 14 * 24 * 60 * 60 * 1000);
  });
});
