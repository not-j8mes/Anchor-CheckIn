import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import http from "node:http";
import { and, eq } from "drizzle-orm";

process.env["DATABASE_URL"] ??= "postgresql://localhost:5432/anchor_checkin";
process.env["SESSION_SECRET"] ??= "test-secret-for-forms";

type DbModule = typeof import("@workspace/db");
let db: DbModule["db"];
let formsTable: DbModule["formsTable"];
let formFieldsTable: DbModule["formFieldsTable"];
let eventsTable: DbModule["eventsTable"];
let organizationsTable: DbModule["organizationsTable"];
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
  formFieldsTable = dbModule.formFieldsTable;
  eventsTable = dbModule.eventsTable;
  organizationsTable = dbModule.organizationsTable;
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

async function postJson(path: string, body: unknown): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      `http://localhost:${port}${path}`,
      { method: "POST", headers: { "content-type": "application/json" } },
      (res) => {
        let raw = "";
        res.on("data", (chunk: string) => { raw += chunk; });
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode ?? 0, body: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode ?? 0, body: raw });
          }
        });
      },
    );
    request.on("error", reject);
    request.end(JSON.stringify(body));
  });
}

async function getPublicFormSlug() {
  const [form] = await db
    .select({ embedSlug: formsTable.embedSlug })
    .from(formsTable)
    .where(and(eq(formsTable.isActive, true), eq(formsTable.isPublic, true)))
    .limit(1);
  return form?.embedSlug;
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
    const embedSlug = await getPublicFormSlug();
    if (!embedSlug) {
      // No forms seeded — skip data-dependent assertions
      return;
    }

    const result = await getJson(`/api/forms/by-slug/${embedSlug}`);
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
    const embedSlug = await getPublicFormSlug();
    if (!embedSlug) return;

    const result = await getJson(`/api/forms/by-slug/${embedSlug}`);
    assert.equal(result.status, 200);

    const body = result.body as Record<string, unknown>;
    const org = body["organization"] as Record<string, unknown> | null | undefined;

    if (org == null) return;

    assert.ok("id" in org, "org.id must be present in public response");
    assert.ok("name" in org, "org.name must be present in public response");
  });

  it("does not expose or accept submissions for inactive forms", async () => {
    const slug = `inactive-test-${Date.now()}`;
    const [form] = await db
      .insert(formsTable)
      .values({ title: "Inactive test form", embedSlug: slug, isActive: false, isPublic: true })
      .returning({ id: formsTable.id });

    try {
      assert.equal((await getJson(`/api/forms/by-slug/${slug}`)).status, 404);
      assert.equal(
        (await postJson(`/api/forms/${form.id}/register`, { fields: [] })).status,
        404,
      );
    } finally {
      await db.delete(formsTable).where(eq(formsTable.id, form.id));
    }
  });

  it("does not expose or accept submissions for private forms", async () => {
    const slug = `private-test-${Date.now()}`;
    const [form] = await db
      .insert(formsTable)
      .values({ title: "Private test form", embedSlug: slug, isActive: true, isPublic: false })
      .returning({ id: formsTable.id });

    try {
      assert.equal((await getJson(`/api/forms/by-slug/${slug}`)).status, 404);
      assert.equal(
        (await postJson(`/api/forms/${form.id}/register`, { fields: [] })).status,
        404,
      );
    } finally {
      await db.delete(formsTable).where(eq(formsTable.id, form.id));
    }
  });

  it("requires an explicit checked value for waiver fields", async () => {
    const suffix = Date.now();
    const [form] = await db
      .insert(formsTable)
      .values({
        title: "Waiver test form",
        embedSlug: `waiver-test-${suffix}`,
        isActive: true,
        isPublic: true,
      })
      .returning({ id: formsTable.id });
    const [waiver] = await db
      .insert(formFieldsTable)
      .values({
        formId: form.id,
        fieldKind: "custom",
        label: "Liability Waiver",
        fieldType: "waiver",
        placeholder: "Test waiver text",
        required: false,
        sortOrder: 0,
      })
      .returning({ id: formFieldsTable.id });

    try {
      const unchecked = await postJson(`/api/forms/${form.id}/register`, {
        fields: [{ fieldId: waiver.id, value: "false" }],
      });
      assert.equal(unchecked.status, 400);
      assert.equal((unchecked.body as { error: string }).error, "Missing required fields");

      const spoofed = await postJson(`/api/forms/${form.id}/register`, {
        fields: [{ fieldId: waiver.id, value: "yes" }],
      });
      assert.equal(spoofed.status, 400);
    } finally {
      await db.delete(formsTable).where(eq(formsTable.id, form.id));
    }
  });

  it("rejects a foreign registration group and rolls back every write", async () => {
    const suffix = Date.now();
    const [organization] = await db
      .insert(organizationsTable)
      .values({ name: `Transaction Test ${suffix}` })
      .returning({ id: organizationsTable.id });
    const [form] = await db
      .insert(formsTable)
      .values({
        organizationId: organization.id,
        title: "Transaction test form",
        embedSlug: `transaction-test-${suffix}`,
        isActive: true,
        isPublic: true,
      })
      .returning({ id: formsTable.id });
    const [field] = await db
      .insert(formFieldsTable)
      .values({
        organizationId: organization.id,
        formId: form.id,
        fieldKind: "system",
        systemKey: "child_first_name",
        label: "Child First Name",
        fieldType: "text",
        required: true,
        sortOrder: 0,
      })
      .returning({ id: formFieldsTable.id });
    const [event] = await db
      .insert(eventsTable)
      .values({
        organizationId: organization.id,
        name: "Transaction test event",
        formId: form.id,
      })
      .returning({ id: eventsTable.id });

    const counts = async () => {
      const result = await pool.query<{
        participants: string;
        guardians: string;
        versions: string;
      }>(
        `SELECT
          (SELECT count(*) FROM participants WHERE organization_id = $1) AS participants,
          (SELECT count(*) FROM guardians WHERE organization_id = $1) AS guardians,
          (SELECT count(*) FROM form_versions WHERE form_id = $2) AS versions`,
        [organization.id, form.id],
      );
      return result.rows[0];
    };

    try {
      const before = await counts();
      const result = await postJson(`/api/forms/${form.id}/register`, {
        fields: [{ fieldId: field.id, value: "Rollback" }],
        registrationGroupId: 2_147_483_647,
      });
      assert.equal(result.status, 400);
      assert.deepEqual(await counts(), before);
    } finally {
      await db.delete(eventsTable).where(eq(eventsTable.id, event.id));
      await db.delete(formsTable).where(eq(formsTable.id, form.id));
      await db.delete(organizationsTable).where(eq(organizationsTable.id, organization.id));
    }
  });
});
