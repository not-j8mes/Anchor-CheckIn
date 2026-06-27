import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
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
let emailModule: typeof import("../lib/email");

const originalResendApiKey = process.env["RESEND_API_KEY"];
const originalEmailFrom = process.env["EMAIL_FROM"];
const originalEmailReplyTo = process.env["EMAIL_REPLY_TO"];
const originalAppBaseUrl = process.env["APP_BASE_URL"];

before(async () => {
  const [dbModule, appModule, loadedEmailModule] = await Promise.all([
    import("@workspace/db"),
    import("../app"),
    import("../lib/email"),
  ]);
  db = dbModule.db;
  formsTable = dbModule.formsTable;
  formFieldsTable = dbModule.formFieldsTable;
  eventsTable = dbModule.eventsTable;
  organizationsTable = dbModule.organizationsTable;
  pool = dbModule.pool;
  emailModule = loadedEmailModule;

  server = http.createServer(appModule.default);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  port = (server.address() as { port: number }).port;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
});

afterEach(() => {
  emailModule.setEmailTransportForTests(null);
  if (originalResendApiKey === undefined) delete process.env["RESEND_API_KEY"];
  else process.env["RESEND_API_KEY"] = originalResendApiKey;
  if (originalEmailFrom === undefined) delete process.env["EMAIL_FROM"];
  else process.env["EMAIL_FROM"] = originalEmailFrom;
  if (originalEmailReplyTo === undefined) delete process.env["EMAIL_REPLY_TO"];
  else process.env["EMAIL_REPLY_TO"] = originalEmailReplyTo;
  if (originalAppBaseUrl === undefined) delete process.env["APP_BASE_URL"];
  else process.env["APP_BASE_URL"] = originalAppBaseUrl;
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

async function createRegistrationEmailFixture(input?: {
  registrationType?: string;
  includeEmailField?: boolean;
  scheduleType?: string;
  startDate?: string | null;
  endDate?: string | null;
}) {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const [organization] = await db
    .insert(organizationsTable)
    .values({ name: `Email Test Church ${suffix}` })
    .returning({ id: organizationsTable.id });
  const [form] = await db
    .insert(formsTable)
    .values({
      organizationId: organization.id,
      title: `Email test form ${suffix}`,
      embedSlug: `email-test-${suffix}`,
      isActive: true,
      isPublic: true,
    })
    .returning({ id: formsTable.id });
  const [event] = await db
    .insert(eventsTable)
    .values({
      organizationId: organization.id,
      name: `Email Test Event ${suffix}`,
      formId: form.id,
      registrationType: input?.registrationType ?? "child_checkin",
      scheduleType: input?.scheduleType ?? "one_time",
      startDate: input?.startDate ?? "2026-07-12",
      endDate: input?.endDate ?? null,
    })
    .returning({ id: eventsTable.id, name: eventsTable.name });

  const fieldsToCreate = [
    {
      organizationId: organization.id,
      formId: form.id,
      fieldKind: "system",
      systemKey: "child_first_name",
      label: "Child First Name",
      fieldType: "text",
      required: true,
      sortOrder: 0,
    },
    {
      organizationId: organization.id,
      formId: form.id,
      fieldKind: "system",
      systemKey: "child_last_name",
      label: "Child Last Name",
      fieldType: "text",
      required: true,
      sortOrder: 1,
    },
    {
      organizationId: organization.id,
      formId: form.id,
      fieldKind: "system",
      systemKey: "guardian_first_name",
      label: "Parent / Guardian First Name",
      fieldType: "text",
      required: false,
      sortOrder: 2,
    },
    {
      organizationId: organization.id,
      formId: form.id,
      fieldKind: "system",
      systemKey: "guardian_last_name",
      label: "Parent / Guardian Last Name",
      fieldType: "text",
      required: false,
      sortOrder: 3,
    },
    {
      organizationId: organization.id,
      formId: form.id,
      fieldKind: "system",
      systemKey: "guardian_phone",
      label: "Parent / Guardian Phone",
      fieldType: "phone",
      required: false,
      sortOrder: 4,
    },
    ...(input?.includeEmailField === false
      ? []
      : [
          {
            organizationId: organization.id,
            formId: form.id,
            fieldKind: "system",
            systemKey: "guardian_email",
            label: "Parent / Guardian Email",
            fieldType: "email",
            required: false,
            sortOrder: 5,
          },
        ]),
  ];

  const fields = await db.insert(formFieldsTable).values(fieldsToCreate).returning();
  const fieldByKey = new Map(fields.map((field) => [field.systemKey, field]));
  const fieldsPayload = [
    { fieldId: fieldByKey.get("child_first_name")!.id, value: "Jamie" },
    { fieldId: fieldByKey.get("child_last_name")!.id, value: "Rivera" },
    { fieldId: fieldByKey.get("guardian_first_name")!.id, value: "Taylor" },
    { fieldId: fieldByKey.get("guardian_last_name")!.id, value: "Rivera" },
    { fieldId: fieldByKey.get("guardian_phone")!.id, value: "555-0100" },
    ...(fieldByKey.has("guardian_email")
      ? [{ fieldId: fieldByKey.get("guardian_email")!.id, value: "parent@example.com" }]
      : []),
  ];

  return { organization, form, event, fieldsPayload };
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

const PRIVATE_PUBLIC_FORM_FIELDS = [
  "organizationId",
  "confirmationEmailEnabled",
  "confirmationEmailSubject",
  "confirmationEmailMessage",
  "embedSlug",
  "submissionCount",
  "createdAt",
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

  it("form object does not include internal settings or email templates", async () => {
    const embedSlug = await getPublicFormSlug();
    if (!embedSlug) return;

    const result = await getJson(`/api/forms/by-slug/${embedSlug}`);
    assert.equal(result.status, 200);

    const body = result.body as Record<string, unknown>;
    for (const field of PRIVATE_PUBLIC_FORM_FIELDS) {
      assert.ok(
        !(field in body),
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

  it("saves a registration when the confirmation email sends", async () => {
    const fixture = await createRegistrationEmailFixture();
    const sent: unknown[] = [];
    process.env["RESEND_API_KEY"] = "test-resend-key";
    process.env["EMAIL_FROM"] = "registrations@example.com";
    emailModule.setEmailTransportForTests({
      async send(payload) {
        sent.push(payload);
      },
    });

    try {
      const result = await postJson(`/api/forms/${fixture.form.id}/register`, {
        fields: fixture.fieldsPayload,
      });

      assert.equal(result.status, 201);
      assert.equal(sent.length, 1);
      assert.equal((sent[0] as { to: string }).to, "parent@example.com");
      assert.equal(
        (sent[0] as { subject: string }).subject,
        `Registration confirmed: ${fixture.event.name}`,
      );
    } finally {
      await db.delete(organizationsTable).where(eq(organizationsTable.id, fixture.organization.id));
    }
  });

  it("uses the form confirmation email subject and message when configured", async () => {
    const fixture = await createRegistrationEmailFixture();
    const sent: unknown[] = [];
    process.env["RESEND_API_KEY"] = "test-resend-key";
    process.env["EMAIL_FROM"] = "registrations@example.com";
    emailModule.setEmailTransportForTests({
      async send(payload) {
        sent.push(payload);
      },
    });
    await db
      .update(formsTable)
      .set({
        confirmationEmailSubject: "You are in for {{eventName}}",
        confirmationEmailMessage: "Hi {{primaryContactName}}, we received {{participantNames}} for {{eventDate}}.",
      })
      .where(eq(formsTable.id, fixture.form.id));

    try {
      const result = await postJson(`/api/forms/${fixture.form.id}/register`, {
        fields: fixture.fieldsPayload,
      });

      assert.equal(result.status, 201);
      assert.equal(sent.length, 1);
      assert.equal((sent[0] as { subject: string }).subject, `You are in for ${fixture.event.name}`);
      assert.match(
        (sent[0] as { text: string }).text,
        /Hi Taylor Rivera, we received Jamie Rivera for July 12, 2026\./,
      );
    } finally {
      await db.delete(organizationsTable).where(eq(organizationsTable.id, fixture.organization.id));
    }
  });

  it("renders safe formatting markers in confirmation email HTML", async () => {
    const fixture = await createRegistrationEmailFixture();
    const sent: unknown[] = [];
    process.env["RESEND_API_KEY"] = "test-resend-key";
    process.env["EMAIL_FROM"] = "registrations@example.com";
    emailModule.setEmailTransportForTests({
      async send(payload) {
        sent.push(payload);
      },
    });
    await db
      .update(formsTable)
      .set({
        confirmationEmailMessage: "Hello **{{primaryContactName}}**\n[large]_{{eventName}}_[/large]",
      })
      .where(eq(formsTable.id, fixture.form.id));

    try {
      const result = await postJson(`/api/forms/${fixture.form.id}/register`, {
        fields: fixture.fieldsPayload,
      });

      assert.equal(result.status, 201);
      assert.match((sent[0] as { html: string }).html, /Hello <strong>Taylor Rivera<\/strong><br>/);
      assert.match(
        (sent[0] as { html: string }).html,
        /<span style="font-size: 18px;"><em>Email Test Event/,
      );
      assert.match((sent[0] as { text: string }).text, /Hello Taylor Rivera\nEmail Test Event/);
    } finally {
      await db.delete(organizationsTable).where(eq(organizationsTable.id, fixture.organization.id));
    }
  });

  it("renders a date range for multi-day event confirmation emails", async () => {
    const fixture = await createRegistrationEmailFixture({
      scheduleType: "multi_day",
      startDate: "2026-07-12",
      endDate: "2026-07-14",
    });
    const sent: unknown[] = [];
    process.env["RESEND_API_KEY"] = "test-resend-key";
    process.env["EMAIL_FROM"] = "registrations@example.com";
    emailModule.setEmailTransportForTests({
      async send(payload) {
        sent.push(payload);
      },
    });
    await db
      .update(formsTable)
      .set({ confirmationEmailMessage: "Dates: {{eventDate}}" })
      .where(eq(formsTable.id, fixture.form.id));

    try {
      const result = await postJson(`/api/forms/${fixture.form.id}/register`, {
        fields: fixture.fieldsPayload,
      });

      assert.equal(result.status, 201);
      assert.match((sent[0] as { text: string }).text, /Dates: July 12-14, 2026/);
    } finally {
      await db.delete(organizationsTable).where(eq(organizationsTable.id, fixture.organization.id));
    }
  });

  it("renders a starts label for repeating event confirmation emails", async () => {
    const fixture = await createRegistrationEmailFixture({
      scheduleType: "repeating",
      startDate: "2026-07-12",
      endDate: "2026-08-30",
    });
    const sent: unknown[] = [];
    process.env["RESEND_API_KEY"] = "test-resend-key";
    process.env["EMAIL_FROM"] = "registrations@example.com";
    emailModule.setEmailTransportForTests({
      async send(payload) {
        sent.push(payload);
      },
    });
    await db
      .update(formsTable)
      .set({ confirmationEmailMessage: "Dates: {{eventDate}}" })
      .where(eq(formsTable.id, fixture.form.id));

    try {
      const result = await postJson(`/api/forms/${fixture.form.id}/register`, {
        fields: fixture.fieldsPayload,
      });

      assert.equal(result.status, 201);
      assert.match((sent[0] as { text: string }).text, /Dates: Starts July 12, 2026/);
    } finally {
      await db.delete(organizationsTable).where(eq(organizationsTable.id, fixture.organization.id));
    }
  });

  it("sends one confirmation with all participants from the current multi-child submission", async () => {
    const fixture = await createRegistrationEmailFixture();
    const sent: unknown[] = [];
    process.env["RESEND_API_KEY"] = "test-resend-key";
    process.env["EMAIL_FROM"] = "registrations@example.com";
    emailModule.setEmailTransportForTests({
      async send(payload) {
        sent.push(payload);
      },
    });
    await db
      .update(formsTable)
      .set({ confirmationEmailMessage: "Children: {{participantNames}}" })
      .where(eq(formsTable.id, fixture.form.id));

    try {
      const first = await postJson(`/api/forms/${fixture.form.id}/register`, {
        fields: fixture.fieldsPayload,
        suppressConfirmationEmail: true,
      });
      const second = await postJson(`/api/forms/${fixture.form.id}/register`, {
        fields: fixture.fieldsPayload.map((field) =>
          field.value === "Jamie" ? { ...field, value: "Jordan" } : field,
        ),
        confirmationParticipantNames: ["Jamie Rivera", "Jordan Rivera"],
      });

      assert.equal(first.status, 201);
      assert.equal(second.status, 201);
      assert.equal(sent.length, 1);
      assert.match((sent[0] as { text: string }).text, /Children: Jamie Rivera and Jordan Rivera/);
    } finally {
      await db.delete(organizationsTable).where(eq(organizationsTable.id, fixture.organization.id));
    }
  });

  it("formats three confirmation participants with an Oxford comma", async () => {
    const fixture = await createRegistrationEmailFixture();
    const sent: unknown[] = [];
    process.env["RESEND_API_KEY"] = "test-resend-key";
    process.env["EMAIL_FROM"] = "registrations@example.com";
    emailModule.setEmailTransportForTests({
      async send(payload) {
        sent.push(payload);
      },
    });
    await db
      .update(formsTable)
      .set({ confirmationEmailMessage: "Children: {{participantNames}}" })
      .where(eq(formsTable.id, fixture.form.id));

    try {
      const result = await postJson(`/api/forms/${fixture.form.id}/register`, {
        fields: fixture.fieldsPayload,
        confirmationParticipantNames: ["Jamie Rivera", "Jordan Rivera", "Casey Rivera"],
      });

      assert.equal(result.status, 201);
      assert.match((sent[0] as { text: string }).text, /Children: Jamie Rivera, Jordan Rivera, and Casey Rivera/);
    } finally {
      await db.delete(organizationsTable).where(eq(organizationsTable.id, fixture.organization.id));
    }
  });

  it("does not include prior family submissions in later confirmation emails", async () => {
    const fixture = await createRegistrationEmailFixture();
    const sent: unknown[] = [];
    process.env["RESEND_API_KEY"] = "test-resend-key";
    process.env["EMAIL_FROM"] = "registrations@example.com";
    emailModule.setEmailTransportForTests({
      async send(payload) {
        sent.push(payload);
      },
    });
    await db
      .update(formsTable)
      .set({ confirmationEmailMessage: "Children: {{participantNames}}" })
      .where(eq(formsTable.id, fixture.form.id));

    try {
      const result = await postJson(`/api/forms/${fixture.form.id}/register`, {
        fields: fixture.fieldsPayload.map((field) =>
          field.value === "Jamie" ? { ...field, value: "Casey" } : field,
        ),
        confirmationParticipantNames: ["Casey Rivera"],
      });

      assert.equal(result.status, 201);
      assert.equal(sent.length, 1);
      assert.match((sent[0] as { text: string }).text, /Children: Casey Rivera/);
      assert.doesNotMatch((sent[0] as { text: string }).text, /Jamie Rivera/);
    } finally {
      await db.delete(organizationsTable).where(eq(organizationsTable.id, fixture.organization.id));
    }
  });

  it("saves a registration and skips email when disabled for the form", async () => {
    const fixture = await createRegistrationEmailFixture();
    let sendAttempts = 0;
    process.env["RESEND_API_KEY"] = "test-resend-key";
    process.env["EMAIL_FROM"] = "registrations@example.com";
    emailModule.setEmailTransportForTests({
      async send() {
        sendAttempts += 1;
      },
    });
    await db
      .update(formsTable)
      .set({ confirmationEmailEnabled: false })
      .where(eq(formsTable.id, fixture.form.id));

    try {
      const result = await postJson(`/api/forms/${fixture.form.id}/register`, {
        fields: fixture.fieldsPayload,
      });

      assert.equal(result.status, 201);
      assert.equal(sendAttempts, 0);
    } finally {
      await db.delete(organizationsTable).where(eq(organizationsTable.id, fixture.organization.id));
    }
  });

  it("saves a registration when confirmation email sending fails", async () => {
    const fixture = await createRegistrationEmailFixture();
    process.env["RESEND_API_KEY"] = "test-resend-key";
    process.env["EMAIL_FROM"] = "registrations@example.com";
    emailModule.setEmailTransportForTests({
      async send() {
        throw new Error("simulated email failure");
      },
    });

    try {
      const result = await postJson(`/api/forms/${fixture.form.id}/register`, {
        fields: fixture.fieldsPayload,
      });

      assert.equal(result.status, 201);
    } finally {
      await db.delete(organizationsTable).where(eq(organizationsTable.id, fixture.organization.id));
    }
  });

  it("saves a registration and skips email when RESEND_API_KEY is missing", async () => {
    const fixture = await createRegistrationEmailFixture();
    let sendAttempts = 0;
    delete process.env["RESEND_API_KEY"];
    process.env["EMAIL_FROM"] = "registrations@example.com";
    emailModule.setEmailTransportForTests({
      async send() {
        sendAttempts += 1;
      },
    });

    try {
      const result = await postJson(`/api/forms/${fixture.form.id}/register`, {
        fields: fixture.fieldsPayload,
      });

      assert.equal(result.status, 201);
      assert.equal(sendAttempts, 0);
    } finally {
      await db.delete(organizationsTable).where(eq(organizationsTable.id, fixture.organization.id));
    }
  });

  it("saves a registration and skips email when no recipient exists", async () => {
    const fixture = await createRegistrationEmailFixture({ includeEmailField: false });
    let sendAttempts = 0;
    process.env["RESEND_API_KEY"] = "test-resend-key";
    process.env["EMAIL_FROM"] = "registrations@example.com";
    emailModule.setEmailTransportForTests({
      async send() {
        sendAttempts += 1;
      },
    });

    try {
      const result = await postJson(`/api/forms/${fixture.form.id}/register`, {
        fields: fixture.fieldsPayload,
      });

      assert.equal(result.status, 201);
      assert.equal(sendAttempts, 0);
    } finally {
      await db.delete(organizationsTable).where(eq(organizationsTable.id, fixture.organization.id));
    }
  });
});
