import { Router } from "express";
import { and, eq, sql, desc, inArray, asc } from "drizzle-orm";
import { db, eventsTable, formsTable, questionsTable, formFieldsTable, registrationsTable, checkinsTable, registrationCustomAnswersTable, eventSessionsTable, organizationsTable } from "@workspace/db";
import { randomBytes } from "crypto";
import { createEventSessions, ensureEventDateSessions } from "./event-sessions";
import { requireAuthContext, requireOrganizationRole } from "../lib/auth";
import { sendEventRegistrantEmail } from "../lib/email";
import { eventRegistrantEmailRateLimiter } from "../lib/rateLimits";

const router = Router();
const MAX_EVENT_EMAIL_RECIPIENTS = 500;

const DEFAULT_QUESTIONS = [
  { label: "Child's First Name", type: "text", required: true, order: 0, isChildField: true, fieldKey: "childFirstName", placeholder: "Enter first name" },
  { label: "Child's Last Name", type: "text", required: true, order: 1, isChildField: true, fieldKey: "childLastName", placeholder: "Enter last name" },
  { label: "Date of Birth", type: "date", required: true, order: 2, isChildField: true, fieldKey: "childDateOfBirth", placeholder: "" },
  { label: "Parent/Guardian Name", type: "text", required: true, order: 3, isChildField: false, fieldKey: "guardianName", placeholder: "Full name" },
  { label: "Phone Number", type: "phone", required: true, order: 4, isChildField: false, fieldKey: "guardianPhone", placeholder: "(555) 000-0000" },
  { label: "Email Address", type: "email", required: false, order: 5, isChildField: false, fieldKey: "guardianEmail", placeholder: "email@example.com" },
  { label: "Allergies or Medical Notes", type: "textarea", required: false, order: 6, isChildField: true, fieldKey: "allergies", placeholder: "List any allergies or medical conditions..." },
];

/**
 * Template: Child Check-In
 * For kids programs — child profiles, guardian info, emergency contacts, safety.
 */
const TEMPLATE_CHILD_CHECKIN = [
  { fieldKind: "system", systemKey: "child_first_name",          label: "Child First Name",                     fieldType: "text",     required: true,  sortOrder: 0,  placeholder: "Enter first name",                              options: null,     sectionKey: null },
  { fieldKind: "system", systemKey: "child_last_name",           label: "Child Last Name",                      fieldType: "text",     required: true,  sortOrder: 1,  placeholder: "Enter last name",                               options: null,     sectionKey: null },
  { fieldKind: "system", systemKey: "date_of_birth",             label: "Date of Birth",                        fieldType: "date",     required: true,  sortOrder: 2,  placeholder: null,                                            options: null,     sectionKey: null },
  { fieldKind: "system", systemKey: "guardian_first_name",       label: "Parent / Guardian First Name",         fieldType: "text",     required: true,  sortOrder: 3,  placeholder: "First name",                                    options: null,     sectionKey: null },
  { fieldKind: "system", systemKey: "guardian_last_name",        label: "Parent / Guardian Last Name",          fieldType: "text",     required: true,  sortOrder: 4,  placeholder: "Last name",                                     options: null,     sectionKey: null },
  { fieldKind: "system", systemKey: "guardian_phone",            label: "Parent / Guardian Phone",              fieldType: "phone",    required: true,  sortOrder: 5,  placeholder: "(555) 000-0000",                                options: null,     sectionKey: null },
  { fieldKind: "system", systemKey: "guardian_email",            label: "Parent / Guardian Email",              fieldType: "email",    required: true,  sortOrder: 6,  placeholder: "email@example.com",                             options: null,     sectionKey: null },
  { fieldKind: "system", systemKey: "allergies",                 label: "Allergies",                            fieldType: "textarea", required: false, sortOrder: 7,  placeholder: "List any food, medication, or environmental allergies…", options: null, sectionKey: null },
  { fieldKind: "system", systemKey: "medical_notes",             label: "Medical Notes",                        fieldType: "textarea", required: false, sortOrder: 8,  placeholder: "Any diagnoses, medications, or medical considerations…",  options: null, sectionKey: null },
  { fieldKind: "system", systemKey: "emergency_contact_name",    label: "Emergency Contact Name",               fieldType: "text",     required: true,  sortOrder: 9,  placeholder: "Full name",                                     options: null,     sectionKey: null },
  { fieldKind: "system", systemKey: "emergency_contact_phone",   label: "Emergency Contact Phone",              fieldType: "phone",    required: true,  sortOrder: 10, placeholder: "(555) 000-0000",                                options: null,     sectionKey: null },
] as const;

/**
 * Template: Family or Group Registration
 * One registrant covers multiple people. allowAdditionalPeople enabled on the form.
 */
const TEMPLATE_FAMILY_GROUP = [
  // ── Required ───────────────────────────────────────────────────────────────
  { fieldKind: "system", systemKey: "participant_first_name",    label: "First Name",                           fieldType: "text",     required: true,  sortOrder: 0,  placeholder: "Enter first name",                              options: null },
  { fieldKind: "system", systemKey: "participant_last_name",     label: "Last Name",                            fieldType: "text",     required: true,  sortOrder: 1,  placeholder: "Enter last name",                               options: null },
  { fieldKind: "system", systemKey: "participant_email",         label: "Email",                                fieldType: "email",    required: true,  sortOrder: 2,  placeholder: "email@example.com",                             options: null },
  { fieldKind: "system", systemKey: "participant_phone",         label: "Phone",                                fieldType: "phone",    required: true,  sortOrder: 3,  placeholder: "(555) 000-0000",                                options: null },
  // ── Optional ───────────────────────────────────────────────────────────────
  { fieldKind: "system", systemKey: "dietary_restrictions",      label: "Dietary Restrictions",                 fieldType: "textarea", required: false, sortOrder: 4,  placeholder: "List any dietary restrictions or food allergies…", options: null },
  { fieldKind: "system", systemKey: "accessibility_needs",       label: "Accessibility Needs",                  fieldType: "textarea", required: false, sortOrder: 5,  placeholder: "Describe any accessibility requirements…",        options: null },
  { fieldKind: "custom", systemKey: null,                        label: "Notes",                                fieldType: "textarea", required: false, sortOrder: 6,  placeholder: "Anything else we should know…",                  options: null },
] as const;

/**
 * Template: Individual Registration
 * Each person registers themselves. Simple signup, no group linking.
 */
const TEMPLATE_INDIVIDUAL = [
  // ── Required ───────────────────────────────────────────────────────────────
  { fieldKind: "system", systemKey: "participant_first_name",    label: "First Name",                           fieldType: "text",     required: true,  sortOrder: 0,  placeholder: "Enter first name",                              options: null },
  { fieldKind: "system", systemKey: "participant_last_name",     label: "Last Name",                            fieldType: "text",     required: true,  sortOrder: 1,  placeholder: "Enter last name",                               options: null },
  { fieldKind: "system", systemKey: "participant_email",         label: "Email",                                fieldType: "email",    required: true,  sortOrder: 2,  placeholder: "email@example.com",                             options: null },
  { fieldKind: "system", systemKey: "participant_phone",         label: "Phone",                                fieldType: "phone",    required: true,  sortOrder: 3,  placeholder: "(555) 000-0000",                                options: null },
  // ── Optional ───────────────────────────────────────────────────────────────
  { fieldKind: "system", systemKey: "dietary_restrictions",      label: "Dietary Restrictions",                 fieldType: "textarea", required: false, sortOrder: 4,  placeholder: "List any dietary restrictions or food allergies…", options: null },
  { fieldKind: "system", systemKey: "accessibility_needs",       label: "Accessibility Needs",                  fieldType: "textarea", required: false, sortOrder: 5,  placeholder: "Describe any accessibility requirements…",        options: null },
] as const;

function getFormTemplate(registrationType?: string | null) {
  if (registrationType === "family_group") return TEMPLATE_FAMILY_GROUP;
  if (registrationType === "individual") return TEMPLATE_INDIVIDUAL;
  return TEMPLATE_CHILD_CHECKIN; // child_checkin or no type
}

interface CreateEventWithFormInput {
  organizationId: number;
  name: string;
  description?: string | null;
  eventType: string;
  registrationType?: string | null;
  scheduleType?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  repeatFrequency?: string | null;
  repeatDayOfWeek?: number | null;
  formTitle: string;
  formDescription?: string | null;
  addDefaultQuestions?: boolean;
  trackAttendance?: boolean;
  requireCheckout?: boolean;
  printLabels?: boolean;
  labelType?: string | null;
  roomAssignmentMode?: string | null;
}

/**
 * Creates a form (+ legacy questions / form_fields template) and its linked event row.
 * Shared by POST /events and the admin test-data seeder so both stay in sync.
 */
export async function createEventWithForm(input: CreateEventWithFormInput) {
  const {
    name, description, eventType, registrationType, formTitle, formDescription,
    addDefaultQuestions, startDate, endDate, startTime, endTime,
    repeatFrequency, repeatDayOfWeek, trackAttendance, requireCheckout, printLabels, labelType, roomAssignmentMode,
  } = input;
  const { organizationId } = input;

  const resolvedScheduleType = input.scheduleType || "one_time";

  // Smart defaults based on registration type when caller doesn't specify
  const isChildCheckin = !registrationType || registrationType === "child_checkin";
  const resolvedTrackAttendance = trackAttendance !== undefined ? trackAttendance : isChildCheckin;
  const resolvedRequireCheckout = requireCheckout !== undefined ? requireCheckout : isChildCheckin;
  const resolvedPrintLabels = printLabels !== undefined ? printLabels : isChildCheckin;
  const resolvedLabelType = labelType || (resolvedRequireCheckout ? "child_security" : "simple_name");

  const embedSlug = randomBytes(6).toString("hex");
  const [form] = await db
    .insert(formsTable)
    .values({
      title: formTitle,
      organizationId,
      description: formDescription || null,
      isActive: true,
      isPublic: true,
      allowAdditionalPeople: registrationType === "family_group",
      embedSlug,
    })
    .returning();

  if (addDefaultQuestions !== false) {
    // Legacy questions table (backward compat — only seed for child_checkin / no type)
    if (!registrationType || registrationType === "child_checkin") {
      await db.insert(questionsTable).values(
        DEFAULT_QUESTIONS.map((q) => ({ ...q, formId: form.id, organizationId, options: null }))
      );
    }
    // New form_fields table — use the right template for the registration type
    const template = getFormTemplate(registrationType);
    await db.insert(formFieldsTable).values(
      template.map((f) => ({ ...f, formId: form.id, organizationId }))
    );
  }

  const [event] = await db
    .insert(eventsTable)
    .values({
      name,
      organizationId,
      description: description || null,
      eventType,
      registrationType: registrationType || null,
      scheduleType: resolvedScheduleType,
      startDate: startDate || null,
      endDate: endDate || null,
      startTime: startTime || null,
      endTime: endTime || null,
      repeatFrequency: repeatFrequency || null,
      repeatDayOfWeek: repeatDayOfWeek !== undefined ? repeatDayOfWeek : null,
      status: computeStatus(startDate || null, endDate || null),
      formId: form.id,
      trackAttendance: resolvedTrackAttendance,
      requireCheckout: resolvedRequireCheckout,
      printLabels: resolvedPrintLabels,
      labelType: resolvedLabelType,
      roomAssignmentMode: roomAssignmentMode || null,
    })
    .returning();

  // Generate sessions for repeating events
  if (resolvedScheduleType === "repeating" && startDate && endDate && repeatDayOfWeek !== undefined && repeatDayOfWeek !== null) {
    await createEventSessions(event.id, organizationId, startDate, endDate, repeatDayOfWeek, startTime || null, endTime || null);
  }
  await ensureEventDateSessions(event.id);

  const [questions, formFields] = await Promise.all([
    db.select().from(questionsTable).where(eq(questionsTable.formId, form.id)).orderBy(asc(questionsTable.order)),
    db.select().from(formFieldsTable).where(eq(formFieldsTable.formId, form.id)).orderBy(asc(formFieldsTable.sortOrder)),
  ]);

  return { event, form, questions, formFields };
}

function computeStatus(startDate: string | null, endDate: string | null): string {
  const today = new Date().toISOString().slice(0, 10);
  if (!startDate) return "upcoming";
  const end = endDate || startDate;
  if (end < today) return "completed";
  if (startDate <= today) return "active";
  return "upcoming";
}

async function buildEventRow(event: typeof eventsTable.$inferSelect) {
  let formTitle: string | null = null;
  let formEmbedSlug: string | null = null;
  let registrationCount = 0;
  let sessionCount: number | null = null;
  let nextSessionDate: string | null = null;

  if (event.formId) {
    const form = await db.select().from(formsTable).where(eq(formsTable.id, event.formId)).limit(1);
    if (form[0]) {
      formTitle = form[0].title;
      formEmbedSlug = form[0].embedSlug;
    }
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(registrationsTable)
      .where(eq(registrationsTable.formId, event.formId));
    registrationCount = count;
  }

  if (event.scheduleType === "repeating") {
    const sessions = await db
      .select({ id: eventSessionsTable.id, sessionDate: eventSessionsTable.sessionDate, status: eventSessionsTable.status })
      .from(eventSessionsTable)
      .where(eq(eventSessionsTable.eventId, event.id))
      .orderBy(asc(eventSessionsTable.sessionDate));

    sessionCount = sessions.length;
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = sessions.filter((s) => s.sessionDate >= today && s.status !== "cancelled");
    nextSessionDate = upcoming[0]?.sessionDate ?? null;
  }

  return {
    ...event,
    status: computeStatus(event.startDate, event.endDate),
    createdAt: event.createdAt.toISOString(),
    formTitle,
    formEmbedSlug,
    registrationCount,
    sessionCount,
    nextSessionDate,
  };
}

router.get("/events", async (req, res) => {
  const auth = requireAuthContext(req);
  try {
    const events = await db
      .select()
      .from(eventsTable)
      .where(eq(eventsTable.organizationId, auth.organizationId))
      .orderBy(sql`start_date DESC NULLS LAST, created_at DESC`);
    const rows = await Promise.all(events.map(buildEventRow));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list events");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/events", requireOrganizationRole("owner", "admin"), async (req, res) => {
  const auth = requireAuthContext(req);
  const { name, description, eventType, registrationType, scheduleType, startDate, endDate, startTime, endTime, repeatFrequency, repeatDayOfWeek, formTitle, formDescription, addDefaultQuestions, trackAttendance, requireCheckout, printLabels, labelType, roomAssignmentMode } = req.body;

  if (!name || !eventType || !formTitle) {
    res.status(400).json({ error: "name, eventType, and formTitle are required" });
    return;
  }

  try {
    const { event, form, questions, formFields } = await createEventWithForm({
      name, description, eventType, registrationType, scheduleType, startDate, endDate, startTime, endTime,
      organizationId: auth.organizationId,
      repeatFrequency, repeatDayOfWeek, formTitle, formDescription, addDefaultQuestions,
      trackAttendance, requireCheckout, printLabels, labelType, roomAssignmentMode,
    });

    const row = await buildEventRow(event);

    res.status(201).json({
      ...row,
      form: { ...form, submissionCount: 0, questions, formFields },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create event");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/events/:eventId/checkins", async (req, res) => {
  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid eventId" }); return; }
  try {
    const auth = requireAuthContext(req);
    const event = await db.select().from(eventsTable).where(and(eq(eventsTable.id, eventId), eq(eventsTable.organizationId, auth.organizationId))).limit(1);
    if (!event[0]) { res.status(404).json({ error: "Not found" }); return; }
    if (!event[0].formId) { res.json([]); return; }

    const regs = await db.select({ id: registrationsTable.id }).from(registrationsTable)
      .where(eq(registrationsTable.formId, event[0].formId));
    if (regs.length === 0) { res.json([]); return; }
    const regIds = regs.map((r) => r.id);
    const checkins = await db.select().from(checkinsTable)
      .where(inArray(checkinsTable.registrationId, regIds))
      .orderBy(desc(checkinsTable.checkinAt));
    res.json(checkins.map((c) => ({
      ...c,
      checkinAt: c.checkinAt.toISOString(),
      checkoutAt: c.checkoutAt?.toISOString() ?? null,
      updatedAt: c.updatedAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list event checkins");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /events/:eventId/registrations/export ────────────────────────────────
// Returns registration + check-in + custom-answer data for CSV download.
// Must be declared before the bare /:eventId route so Express resolves it first.

router.get("/events/:eventId/registrations/export", async (req, res) => {
  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid eventId" }); return; }

  try {
    const auth = requireAuthContext(req);
    const [event] = await db
      .select()
      .from(eventsTable)
      .where(and(eq(eventsTable.id, eventId), eq(eventsTable.organizationId, auth.organizationId)))
      .limit(1);

    if (!event) { res.status(404).json({ error: "Event not found" }); return; }
    if (!event.formId) {
      res.json({ eventName: event.name, rows: [], customColumns: [] });
      return;
    }

    const registrations = await db
      .select()
      .from(registrationsTable)
      .where(eq(registrationsTable.formId, event.formId))
      .orderBy(asc(registrationsTable.createdAt));

    if (registrations.length === 0) {
      res.json({ eventName: event.name, rows: [], customColumns: [] });
      return;
    }

    const regIds = registrations.map((r) => r.id);

    // Most-recent check-in per registration (desc so first entry = latest)
    const allCheckins = await db
      .select()
      .from(checkinsTable)
      .where(inArray(checkinsTable.registrationId, regIds))
      .orderBy(desc(checkinsTable.checkinAt));

    const latestCheckin = new Map<number, typeof checkinsTable.$inferSelect>();
    for (const c of allCheckins) {
      if (!latestCheckin.has(c.registrationId)) latestCheckin.set(c.registrationId, c);
    }

    // Custom (non-system) answers for all registrations
    const allCustomAnswers = await db
      .select()
      .from(registrationCustomAnswersTable)
      .where(inArray(registrationCustomAnswersTable.registrationId, regIds));

    // Group custom answers and collect unique column names in first-seen order
    const answersByReg = new Map<number, Record<string, string>>();
    const customColumns: string[] = [];
    const seenCols = new Set<string>();
    for (const a of allCustomAnswers) {
      if (!answersByReg.has(a.registrationId)) answersByReg.set(a.registrationId, {});
      answersByReg.get(a.registrationId)![a.questionLabel] = a.answerValue;
      if (!seenCols.has(a.questionLabel)) {
        seenCols.add(a.questionLabel);
        customColumns.push(a.questionLabel);
      }
    }

    const rows = registrations.map((reg) => {
      const checkin = latestCheckin.get(reg.id);
      const checkinStatus = !checkin ? "Not Checked In"
        : checkin.checkoutAt ? "Checked Out"
        : "Checked In";

      return {
        id: reg.id,
        submittedAt: (reg.submittedAt ?? reg.createdAt).toISOString(),
        firstName: reg.childFirstName,
        lastName: reg.childLastName,
        fullName: [reg.childFirstName, reg.childLastName].filter(Boolean).join(" "),
        guardianName: reg.guardianName,
        guardianPhone: reg.guardianPhone,
        guardianEmail: reg.guardianEmail ?? "",
        secondaryGuardianFirstName: reg.secondaryGuardianFirstName ?? "",
        secondaryGuardianLastName: reg.secondaryGuardianLastName ?? "",
        secondaryGuardianPhone: reg.secondaryGuardianPhone ?? "",
        secondaryGuardianEmail: reg.secondaryGuardianEmail ?? "",
        secondaryGuardianRelationship: reg.secondaryGuardianRelationship ?? "",
        allergies: reg.allergies ?? "",
        specialNeeds: reg.specialNeeds ?? "",
        room: reg.room ?? "",
        checkinStatus,
        checkedInAt: checkin?.checkinAt?.toISOString() ?? "",
        checkedOutAt: checkin?.checkoutAt?.toISOString() ?? "",
        customAnswers: answersByReg.get(reg.id) ?? {},
      };
    });

    res.json({ eventName: event.name, rows, customColumns });
  } catch (err) {
    req.log.error({ err }, "Failed to export registrations");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /events/:eventId/registrants/email ─────────────────────────────────
// Sends one event update/follow-up email per unique primary contact email.
// Child registrations often create one row per child, so recipients are
// deduped by normalized guardianEmail before sending.

router.post(
  "/events/:eventId/registrants/email",
  eventRegistrantEmailRateLimiter,
  requireOrganizationRole("owner", "admin"),
  async (req, res) => {
    const eventId = parseInt(String(req.params.eventId), 10);
    if (isNaN(eventId)) {
      res.status(400).json({ error: "Invalid eventId" });
      return;
    }

    const subject =
      typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
    const message =
      typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!subject || subject.length > 200 || !message || message.length > 10000) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }

    try {
      const auth = requireAuthContext(req);
      req.log.info(
        {
          eventId,
          organizationId: auth.organizationId,
          userId: auth.userId,
          subjectLength: subject.length,
          messageLength: message.length,
        },
        "Event registrant email requested",
      );
      const [event] = await db
        .select()
        .from(eventsTable)
        .where(
          and(
            eq(eventsTable.id, eventId),
            eq(eventsTable.organizationId, auth.organizationId),
          ),
        )
        .limit(1);

      if (!event) {
        res.status(404).json({ error: "Event not found" });
        return;
      }
      if (!event.formId) {
        res.json({
          recipientCount: 0,
          sentCount: 0,
          skippedCount: 0,
          failedCount: 0,
          failures: [],
        });
        return;
      }

      const [organization] = await db
        .select()
        .from(organizationsTable)
        .where(eq(organizationsTable.id, auth.organizationId))
        .limit(1);

      const registrations = await db
        .select({
          id: registrationsTable.id,
          childFirstName: registrationsTable.childFirstName,
          childLastName: registrationsTable.childLastName,
          guardianName: registrationsTable.guardianName,
          guardianEmail: registrationsTable.guardianEmail,
        })
        .from(registrationsTable)
        .where(
          and(
            eq(registrationsTable.formId, event.formId),
            eq(registrationsTable.organizationId, auth.organizationId),
          ),
        )
        .orderBy(asc(registrationsTable.createdAt));

      const recipients = new Map<
        string,
        {
          email: string;
          primaryContactName: string | null;
          participantNames: string[];
        }
      >();

      for (const registration of registrations) {
        const email = registration.guardianEmail?.trim();
        if (!email || !email.includes("@")) continue;

        const key = email.toLowerCase();
        const participantName = [
          registration.childFirstName,
          registration.childLastName,
        ]
          .filter(Boolean)
          .join(" ");

        const existing =
          recipients.get(key) ??
          {
            email,
            primaryContactName: registration.guardianName?.trim() || null,
            participantNames: [],
          };

        if (!existing.primaryContactName && registration.guardianName?.trim()) {
          existing.primaryContactName = registration.guardianName.trim();
        }
        if (participantName && !existing.participantNames.includes(participantName)) {
          existing.participantNames.push(participantName);
        }
        recipients.set(key, existing);
      }

      if (recipients.size > MAX_EVENT_EMAIL_RECIPIENTS) {
        req.log.warn(
          {
            eventId,
            organizationId: auth.organizationId,
            userId: auth.userId,
            recipientCount: recipients.size,
            maxRecipients: MAX_EVENT_EMAIL_RECIPIENTS,
          },
          "Event registrant email blocked by recipient cap",
        );
        res.status(400).json({
          error: `Too many recipients. The current limit is ${MAX_EVENT_EMAIL_RECIPIENTS}.`,
          recipientCount: recipients.size,
          maxRecipients: MAX_EVENT_EMAIL_RECIPIENTS,
        });
        return;
      }

      const failures: Array<{ email: string; error: string }> = [];
      let sentCount = 0;
      let skippedCount = 0;

      for (const recipient of recipients.values()) {
        try {
          const result = await sendEventRegistrantEmail({
            to: recipient.email,
            organizationName: organization?.name ?? "Anchor Events",
            eventName: event.name,
            eventDate: event.startDate ?? null,
            eventEndDate: event.endDate ?? null,
            eventScheduleType: event.scheduleType ?? null,
            primaryContactName: recipient.primaryContactName,
            participantNames: recipient.participantNames,
            subjectTemplate: subject,
            messageTemplate: message,
            replyTo: null,
          });

          if (result.skipped) skippedCount += 1;
          else sentCount += 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          failures.push({ email: recipient.email, error: message });
          req.log.error(
            { err, eventId, organizationId: auth.organizationId, email: recipient.email },
            "Failed to send event registrant email",
          );
        }
      }

      req.log.info(
        {
          eventId,
          organizationId: auth.organizationId,
          userId: auth.userId,
          recipientCount: recipients.size,
          sentCount,
          skippedCount,
          failedCount: failures.length,
        },
        "Event registrant email completed",
      );

      res.json({
        recipientCount: recipients.size,
        sentCount,
        skippedCount,
        failedCount: failures.length,
        failures,
      });
    } catch (err) {
      req.log.error({ err, eventId }, "Failed to email event registrants");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

router.get("/events/:eventId", async (req, res) => {
  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) {
    res.status(400).json({ error: "Invalid eventId" });
    return;
  }
  try {
    const auth = requireAuthContext(req);
    const event = await db
      .select()
      .from(eventsTable)
      .where(and(eq(eventsTable.id, eventId), eq(eventsTable.organizationId, auth.organizationId)))
      .limit(1);
    if (!event[0]) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const row = await buildEventRow(event[0]);

    let form = null;
    if (event[0].formId) {
      const formRow = await db.select().from(formsTable).where(eq(formsTable.id, event[0].formId)).limit(1);
      if (formRow[0]) {
        const [questions, formFields] = await Promise.all([
          db.select().from(questionsTable).where(eq(questionsTable.formId, formRow[0].id)).orderBy(asc(questionsTable.order)),
          db.select().from(formFieldsTable).where(eq(formFieldsTable.formId, formRow[0].id)).orderBy(asc(formFieldsTable.sortOrder)),
        ]);
        form = { ...formRow[0], submissionCount: row.registrationCount, questions, formFields };
      }
    }

    res.json({ ...row, form });
  } catch (err) {
    req.log.error({ err }, "Failed to get event");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/events/:eventId", requireOrganizationRole("owner", "admin"), async (req, res) => {
  const eventId = parseInt(String(req.params.eventId), 10);
  if (isNaN(eventId)) {
    res.status(400).json({ error: "Invalid eventId" });
    return;
  }
  const { name, description, eventType, registrationType, scheduleType, startDate, endDate, startTime, endTime, repeatFrequency, repeatDayOfWeek, trackAttendance, requireCheckout, printLabels, labelType, roomAssignmentMode } = req.body;
  try {
    const auth = requireAuthContext(req);
    const [updated] = await db
      .update(eventsTable)
      .set({
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(eventType !== undefined && { eventType }),
        ...(registrationType !== undefined && { registrationType }),
        ...(scheduleType !== undefined && { scheduleType }),
        ...(startDate !== undefined && { startDate }),
        ...(endDate !== undefined && { endDate }),
        ...(startTime !== undefined && { startTime }),
        ...(endTime !== undefined && { endTime }),
        ...(repeatFrequency !== undefined && { repeatFrequency }),
        ...(repeatDayOfWeek !== undefined && { repeatDayOfWeek }),
        ...(trackAttendance !== undefined && { trackAttendance }),
        ...(requireCheckout !== undefined && { requireCheckout }),
        ...(printLabels !== undefined && { printLabels }),
        ...(labelType !== undefined && { labelType }),
        ...(roomAssignmentMode !== undefined && { roomAssignmentMode }),
      })
      .where(and(eq(eventsTable.id, eventId), eq(eventsTable.organizationId, auth.organizationId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await ensureEventDateSessions(eventId);
    res.json(await buildEventRow(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update event");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/events/:eventId", requireOrganizationRole("owner", "admin"), async (req, res) => {
  const eventId = parseInt(String(req.params.eventId), 10);
  if (isNaN(eventId)) {
    res.status(400).json({ error: "Invalid eventId" });
    return;
  }
  try {
    const auth = requireAuthContext(req);
    // Get the linked formId before deleting the event
    const [event] = await db
      .select()
      .from(eventsTable)
      .where(and(eq(eventsTable.id, eventId), eq(eventsTable.organizationId, auth.organizationId)))
      .limit(1);
    const formId = event?.formId ?? null;

    // Delete the event first (removes FK reference to form)
    await db.delete(eventsTable).where(and(eq(eventsTable.id, eventId), eq(eventsTable.organizationId, auth.organizationId)));

    // Then delete the linked form — cascades to questions, registrations, answers, check-ins
    if (formId) {
      await db.delete(formsTable).where(and(eq(formsTable.id, formId), eq(formsTable.organizationId, auth.organizationId)));
    }

    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete event");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
