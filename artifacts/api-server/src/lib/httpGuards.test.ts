import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasAdminAccess,
  isOriginAllowed,
  isPgUniqueViolation,
  parseAllowedOrigins,
} from "./httpGuards";

function requestWithHeaders(headers: Record<string, string | undefined>) {
  return {
    header(name: string) {
      return headers[name.toLowerCase()];
    },
  };
}

describe("http guard helpers", () => {
  it("parses comma-separated CORS origins", () => {
    assert.deepEqual(
      parseAllowedOrigins(" https://a.test,https://b.test ,, "),
      ["https://a.test", "https://b.test"],
    );
  });

  it("allows unrestricted local CORS when no origins are configured", () => {
    assert.equal(isOriginAllowed("http://localhost:5173", [], "development"), true);
  });

  it("requires configured origins in production", () => {
    assert.equal(
      isOriginAllowed("https://app.example", ["https://app.example"], "production"),
      true,
    );
    assert.equal(
      isOriginAllowed("https://other.example", ["https://app.example"], "production"),
      false,
    );
  });

  it("requires admin tokens in production", () => {
    assert.equal(
      hasAdminAccess(requestWithHeaders({}), "secret", "production"),
      false,
    );
    assert.equal(
      hasAdminAccess(
        requestWithHeaders({ "x-admin-token": "secret" }),
        "secret",
        "production",
      ),
      true,
    );
    assert.equal(
      hasAdminAccess(
        requestWithHeaders({ authorization: "Bearer secret" }),
        "secret",
        "production",
      ),
      true,
    );
  });

  it("recognizes PostgreSQL unique-violation errors", () => {
    assert.equal(isPgUniqueViolation({ code: "23505" }), true);
    assert.equal(isPgUniqueViolation({ code: "23503" }), false);
  });
});
