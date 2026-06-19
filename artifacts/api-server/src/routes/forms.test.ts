import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import http from "node:http";

process.env["DATABASE_URL"] ??= "postgresql://localhost:5432/anchor_checkin";
process.env["SESSION_SECRET"] ??= "test-secret-for-forms";

type DbModule = typeof import("@workspace/db");
let db: DbModule["db"];
let formsTable: DbModule["formsTable"];
let pool: DbModule["pool"];
let server: http.Server;
let port: number;

before(async () => {
  const [dbModule, appModule] = await Promise.all([
    import("@workspace/db"),
    import("../app"),
  ]);
  db = dbModule.db;
  formsTable = dbModule.formsTable;
  pool = dbModule.pool;

  server = http.createServer(appModule.default);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  port = (server.address() as { port: number }).port;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
});

async function getJson(path: string): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    http
      .get(`http://localhost:${port}${path}`, (res) => {
        let raw = "";
        res.on("data", (chunk: string) => { raw += chunk; });
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode ?? 0, body: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode ?? 0, body: raw });
          }
        });
      })
      .on("error", reject);
  });
}

const PRIVATE_ORG_FIELDS = [
  "stripeCustomerId",
  "stripeSubscriptionId",
  "printerIp",
  "printerName",
  "printingMode",
  "subscriptionStatus",
  "plan",
  "stripeCustomer_id",
  "stripe_customer_id",
  "stripe_subscription_id",
  "printer_ip",
  "printer_name",
  "printing_mode",
];

describe("GET /api/forms/by-slug/:embedSlug — public org field safety", () => {
  it("returns 404 for a non-existent slug", async () => {
    const result = await getJson("/api/forms/by-slug/000000000000");
    assert.equal(result.status, 404);
  });

  it("organization object does not include private billing or infrastructure fields", async () => {
    const [form] = await db
      .select({ embedSlug: formsTable.embedSlug })
      .from(formsTable)
      .limit(1);

    if (!form) {
      // No forms seeded — skip data-dependent assertions
      return;
    }

    const result = await getJson(`/api/forms/by-slug/${form.embedSlug}`);
    assert.equal(result.status, 200, "expected 200 from valid embedSlug");

    const body = result.body as Record<string, unknown>;
    const org = body["organization"] as Record<string, unknown> | null | undefined;

    // organization may be null if the form has no associated org, which is valid
    if (org == null) return;

    for (const field of PRIVATE_ORG_FIELDS) {
      assert.ok(
        !(field in org),
        `private field "${field}" must not appear in the public /forms/by-slug response`,
      );
    }
  });

  it("organization object includes required public display fields", async () => {
    const [form] = await db
      .select({ embedSlug: formsTable.embedSlug })
      .from(formsTable)
      .limit(1);

    if (!form) return;

    const result = await getJson(`/api/forms/by-slug/${form.embedSlug}`);
    assert.equal(result.status, 200);

    const body = result.body as Record<string, unknown>;
    const org = body["organization"] as Record<string, unknown> | null | undefined;

    if (org == null) return;

    assert.ok("id" in org, "org.id must be present in public response");
    assert.ok("name" in org, "org.name must be present in public response");
  });
});
