/**
 * Seed script — populates the database with realistic test data.
 * Idempotent: events are keyed by name; existing ones are skipped.
 *
 * Run: pnpm --filter @workspace/scripts run seed
 */

import {
  db,
  pool,
  eventsTable,
  formsTable,
  formFieldsTable,
  registrationsTable,
} from "@workspace/db";
import { randomBytes } from "crypto";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const embedSlug = () => randomBytes(6).toString("hex");

// ─── Seed definitions ─────────────────────────────────────────────────────────

type FieldDef = {
  systemKey: string | null;
  label: string;
  fieldType: string;
  required: boolean;
  options?: string;
};

type RegDef = {
  child: [string, string];
  dob: string | null;
  guardian: [string, string, string | null];
  allergies: string | null;
  room: string | null;
};

type EventDef = {
  name: string;
  description: string;
  eventType: string;
  registrationType: string;
  startDate: string;
  endDate: string | null;
  status: string;
  trackAttendance: boolean;
  requireCheckout: boolean;
  printLabels: boolean;
  labelType: string;
  formTitle: string;
  formDescription: string;
  fields: FieldDef[];
  registrations: RegDef[];
};

const EVENTS: EventDef[] = [
  {
    name: "VBS Summer 2025",
    description:
      "Vacation Bible School — a week of crafts, games, worship, and Bible lessons for kids ages 4–12.",
    eventType: "vbs",
    registrationType: "child_checkin",
    startDate: "2025-06-09",
    endDate: "2025-06-13",
    status: "active",
    trackAttendance: true,
    requireCheckout: true,
    printLabels: true,
    labelType: "child_security",
    formTitle: "VBS 2025 Registration",
    formDescription:
      "Register your child for Vacation Bible School! Space is limited — sign up early.",
    fields: [
      { systemKey: "participant.first_name",    label: "Child's First Name",              fieldType: "text",     required: true  },
      { systemKey: "participant.last_name",     label: "Child's Last Name",               fieldType: "text",     required: true  },
      { systemKey: "participant.date_of_birth", label: "Date of Birth",                   fieldType: "date",     required: true  },
      { systemKey: "participant.grade",         label: "Grade (Fall 2025)",               fieldType: "text",     required: false },
      { systemKey: "participant.allergies",     label: "Allergies / Dietary Restrictions",fieldType: "textarea", required: false },
      { systemKey: "guardian.full_name",        label: "Parent / Guardian Name",          fieldType: "text",     required: true  },
      { systemKey: "guardian.phone",            label: "Phone Number",                    fieldType: "phone",    required: true  },
      { systemKey: "guardian.email",            label: "Email Address",                   fieldType: "email",    required: false },
      { systemKey: "emergency_contact.name",    label: "Emergency Contact Name",          fieldType: "text",     required: true  },
      { systemKey: "emergency_contact.phone",   label: "Emergency Contact Phone",         fieldType: "phone",    required: true  },
      { systemKey: "pickup.authorized_name",    label: "Authorized Pickup Person",        fieldType: "text",     required: false },
      { systemKey: null, label: "T-shirt Size", fieldType: "select", required: false,
        options: "Youth S,Youth M,Youth L,Adult S,Adult M,Adult L" },
    ],
    registrations: [
      { child: ["Emma",     "Thornton"],    dob: "2016-03-12", guardian: ["Sarah Thornton",   "555-201-4433", "sarah.thornton@email.com"], allergies: "Peanuts",     room: "Room 1 (Ages 5–6)"  },
      { child: ["Liam",     "Prescott"],    dob: "2015-07-24", guardian: ["David Prescott",   "555-308-9921", "dprescott@gmail.com"],      allergies: null,          room: "Room 2 (Ages 7–8)"  },
      { child: ["Olivia",   "Merritt"],     dob: "2014-11-05", guardian: ["Karen Merritt",    "555-412-6644", null],                        allergies: "Bee stings",  room: "Room 3 (Ages 9–10)" },
      { child: ["Noah",     "Calloway"],    dob: "2017-01-30", guardian: ["James Calloway",   "555-519-3377", "jcalloway@church.org"],       allergies: null,          room: "Room 1 (Ages 5–6)"  },
      { child: ["Sophia",   "Delgado"],     dob: "2016-09-18", guardian: ["Maria Delgado",    "555-623-8812", "mdelgado@email.com"],          allergies: "Gluten",      room: "Room 1 (Ages 5–6)"  },
      { child: ["Elijah",   "Nkrumah"],     dob: "2015-04-02", guardian: ["Grace Nkrumah",    "555-714-5566", null],                         allergies: null,          room: "Room 2 (Ages 7–8)"  },
      { child: ["Ava",      "Sullivan"],    dob: "2013-12-20", guardian: ["Patrick Sullivan",  "555-820-2299", "psullivan@email.com"],         allergies: null,          room: "Room 3 (Ages 9–10)" },
      { child: ["Mason",    "Okonkwo"],     dob: "2014-06-15", guardian: ["Amaka Okonkwo",    "555-911-7788", "amaka.o@gmail.com"],           allergies: "Latex",       room: "Room 3 (Ages 9–10)" },
      { child: ["Isabella", "Park"],        dob: "2017-08-08", guardian: ["Jin Park",          "555-034-4411", null],                         allergies: null,          room: "Room 1 (Ages 5–6)"  },
      { child: ["Lucas",    "Beaumont"],    dob: "2016-02-27", guardian: ["Claire Beaumont",   "555-192-6633", "claire.b@email.com"],          allergies: null,          room: "Room 2 (Ages 7–8)"  },
    ],
  },
  {
    name: "Sunday School Fall 2025",
    description:
      "Weekly Sunday School classes for children ages 3–12. Classes meet every Sunday at 9 AM.",
    eventType: "sunday_school",
    registrationType: "child_checkin",
    startDate: "2025-09-07",
    endDate: "2025-12-14",
    status: "upcoming",
    trackAttendance: true,
    requireCheckout: true,
    printLabels: true,
    labelType: "child_security",
    formTitle: "Sunday School 2025 Registration",
    formDescription: "Register your child for Sunday School this fall. Classes begin September 7.",
    fields: [
      { systemKey: "participant.first_name",    label: "Child's First Name",         fieldType: "text",     required: true  },
      { systemKey: "participant.last_name",     label: "Child's Last Name",          fieldType: "text",     required: true  },
      { systemKey: "participant.date_of_birth", label: "Date of Birth",              fieldType: "date",     required: true  },
      { systemKey: "participant.allergies",     label: "Allergies / Medical Notes",  fieldType: "textarea", required: false },
      { systemKey: "guardian.full_name",        label: "Parent / Guardian Name",     fieldType: "text",     required: true  },
      { systemKey: "guardian.phone",            label: "Phone Number",               fieldType: "phone",    required: true  },
      { systemKey: "guardian.email",            label: "Email Address",              fieldType: "email",    required: false },
      { systemKey: "emergency_contact.name",    label: "Emergency Contact",          fieldType: "text",     required: true  },
      { systemKey: "emergency_contact.phone",   label: "Emergency Contact Phone",    fieldType: "phone",    required: true  },
      { systemKey: null, label: "Preferred Class Age Group", fieldType: "select", required: false,
        options: "Preschool (3–4),Kindergarten (5–6),1st–2nd Grade,3rd–4th Grade,5th–6th Grade" },
    ],
    registrations: [
      { child: ["Harper",    "Jensen"],    dob: "2018-05-14", guardian: ["Mike Jensen",    "555-221-8844", "mjensen@email.com"],    allergies: null,        room: "Preschool"     },
      { child: ["Benjamin",  "Castro"],    dob: "2016-11-02", guardian: ["Rosa Castro",    "555-334-6611", null],                   allergies: "Shellfish", room: "1st–2nd Grade" },
      { child: ["Mia",       "Williams"],  dob: "2015-03-19", guardian: ["Tina Williams",  "555-445-3322", "tina.w@gmail.com"],     allergies: null,        room: "3rd–4th Grade" },
      { child: ["Ethan",     "Kowalski"],  dob: "2017-09-07", guardian: ["Paul Kowalski",  "555-556-9977", "pkowalski@email.com"],  allergies: "Penicillin",room: "Kindergarten"  },
      { child: ["Amelia",    "Diaz"],      dob: "2014-01-25", guardian: ["Carlos Diaz",    "555-667-1155", null],                   allergies: null,        room: "3rd–4th Grade" },
      { child: ["James",     "O'Brien"],   dob: "2018-07-31", guardian: ["Fiona O'Brien",  "555-778-4488", "fobrien@email.com"],    allergies: null,        room: "Preschool"     },
      { child: ["Charlotte", "Singh"],     dob: "2013-10-11", guardian: ["Priya Singh",    "555-889-7733", null],                   allergies: null,        room: "5th–6th Grade" },
    ],
  },
  {
    name: "AWANA 2024–2025",
    description:
      "AWANA meets Wednesday evenings 6:30–8 PM for kids in K–6th grade. Scripture memorization, games, and Bible study.",
    eventType: "awana",
    registrationType: "child_checkin",
    startDate: "2024-09-04",
    endDate: "2025-05-28",
    status: "completed",
    trackAttendance: true,
    requireCheckout: false,
    printLabels: true,
    labelType: "simple_name",
    formTitle: "AWANA 2024–2025 Enrollment",
    formDescription: "Enroll your child in AWANA for the 2024–2025 school year. All are welcome!",
    fields: [
      { systemKey: "participant.first_name",    label: "Child's First Name", fieldType: "text",  required: true  },
      { systemKey: "participant.last_name",     label: "Child's Last Name",  fieldType: "text",  required: true  },
      { systemKey: "participant.date_of_birth", label: "Date of Birth",      fieldType: "date",  required: true  },
      { systemKey: "participant.grade",         label: "Current Grade",      fieldType: "select",required: true,
        options: "Kindergarten,1st,2nd,3rd,4th,5th,6th" },
      { systemKey: "guardian.full_name",        label: "Parent / Guardian Name", fieldType: "text", required: true  },
      { systemKey: "guardian.phone",            label: "Phone Number",           fieldType: "phone",required: true  },
      { systemKey: null, label: "AWANA Club", fieldType: "select", required: false,
        options: "Cubbies (K),Sparks (1st–2nd),T&T (3rd–6th)" },
      { systemKey: null, label: "Returning AWANA member?", fieldType: "select", required: false,
        options: "Yes,No" },
    ],
    registrations: [
      { child: ["Oliver",    "Fitzgerald"], dob: "2015-02-08", guardian: ["Brian Fitzgerald", "555-112-3344", "bfitz@email.com"],  allergies: null, room: "Sparks"   },
      { child: ["Penelope",  "Yuen"],       dob: "2016-06-22", guardian: ["Linda Yuen",        "555-223-5566", null],              allergies: null, room: "Sparks"   },
      { child: ["Henry",     "Osei"],       dob: "2014-09-13", guardian: ["Kwame Osei",         "555-334-7788", "kosei@gmail.com"],allergies: null, room: "T&T"      },
      { child: ["Luna",      "Perez"],      dob: "2017-12-01", guardian: ["Elena Perez",         "555-445-9900", null],            allergies: "Eggs",room: "Cubbies" },
      { child: ["Jackson",   "Hartley"],    dob: "2013-04-17", guardian: ["Stephen Hartley",     "555-556-1122", "shartley@email.com"],allergies: null,room: "T&T"   },
      { child: ["Aria",      "Nakamura"],   dob: "2016-03-29", guardian: ["Yuki Nakamura",       "555-667-3344", null],            allergies: null, room: "Sparks"   },
      { child: ["Sebastian", "Brooks"],     dob: "2018-08-05", guardian: ["Angela Brooks",        "555-778-5566", "abrooks@email.com"],allergies: null,room: "Cubbies"},
      { child: ["Scarlett",  "Mwangi"],     dob: "2014-11-23", guardian: ["Joyce Mwangi",         "555-889-7788", null],           allergies: null, room: "T&T"      },
    ],
  },
  {
    name: "Harvest Festival 2024",
    description:
      "Annual fall community gathering with food, games, hayrides, and a pie contest. Open to all ages!",
    eventType: "special_event",
    registrationType: "individual",
    startDate: "2024-10-26",
    endDate: null,
    status: "completed",
    trackAttendance: false,
    requireCheckout: false,
    printLabels: false,
    labelType: "simple_name",
    formTitle: "Harvest Festival RSVP",
    formDescription:
      "RSVP for the Harvest Festival! Admission is free — registration helps us plan food and activities.",
    fields: [
      { systemKey: "participant.first_name", label: "First Name",    fieldType: "text",  required: true  },
      { systemKey: "participant.last_name",  label: "Last Name",     fieldType: "text",  required: true  },
      { systemKey: "guardian.email",         label: "Email Address", fieldType: "email", required: false },
      { systemKey: "guardian.phone",         label: "Phone Number",  fieldType: "phone", required: false },
      { systemKey: null, label: "How many in your party?", fieldType: "select", required: true,
        options: "1,2,3,4,5,6+" },
      { systemKey: null, label: "Entering the pie contest?", fieldType: "select", required: false,
        options: "Yes – fruit pie,Yes – cream pie,Yes – savory pie,No" },
      { systemKey: null, label: "Dietary restrictions", fieldType: "text", required: false },
    ],
    registrations: [
      { child: ["Tom",      "Baker"],       dob: null, guardian: ["Tom Baker",       "555-100-2233", "tbaker@email.com"],   allergies: null, room: null },
      { child: ["Rachel",   "Nguyen"],      dob: null, guardian: ["Rachel Nguyen",   "555-200-4455", null],                 allergies: null, room: null },
      { child: ["Marcus",   "Ellison"],     dob: null, guardian: ["Marcus Ellison",  "555-300-6677", "mellison@email.com"], allergies: null, room: null },
      { child: ["Diana",    "Kostadinova"], dob: null, guardian: ["Diana K.",        "555-400-8899", null],                 allergies: null, room: null },
      { child: ["George",   "Abrams"],      dob: null, guardian: ["George Abrams",   "555-500-1122", "gabrams@gmail.com"],  allergies: null, room: null },
      { child: ["Patricia", "Lowe"],        dob: null, guardian: ["Patricia Lowe",   "555-600-3344", null],                 allergies: null, room: null },
    ],
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("🌱  Starting seed…\n");

  for (const def of EVENTS) {
    // ── Idempotency: skip if event name already exists ─────────────────────
    const { rows } = await pool.query<{ id: number }>(
      "SELECT id FROM events WHERE name = $1 LIMIT 1",
      [def.name]
    );
    if (rows.length > 0) {
      console.log(`  ⏭  "${def.name}" — already exists, skipping`);
      continue;
    }

    // ── Form ───────────────────────────────────────────────────────────────
    const [form] = await db
      .insert(formsTable)
      .values({
        title: def.formTitle,
        description: def.formDescription,
        isActive: true,
        isPublic: true,
        allowAdditionalPeople: false,
        embedSlug: embedSlug(),
      })
      .returning();

    // ── Form fields ────────────────────────────────────────────────────────
    for (let i = 0; i < def.fields.length; i++) {
      const f = def.fields[i];
      await db.insert(formFieldsTable).values({
        formId: form.id,
        fieldKind: f.systemKey ? "system" : "custom",
        systemKey: f.systemKey ?? undefined,
        label: f.label,
        fieldType: f.fieldType,
        required: f.required,
        sortOrder: i,
        options: f.options,
      });
    }

    // ── Event ──────────────────────────────────────────────────────────────
    const [event] = await db
      .insert(eventsTable)
      .values({
        name: def.name,
        description: def.description,
        eventType: def.eventType,
        registrationType: def.registrationType,
        startDate: def.startDate,
        endDate: def.endDate ?? undefined,
        status: def.status,
        formId: form.id,
        trackAttendance: def.trackAttendance,
        requireCheckout: def.requireCheckout,
        printLabels: def.printLabels,
        labelType: def.labelType,
      })
      .returning();

    // ── Registrations ──────────────────────────────────────────────────────
    for (const reg of def.registrations) {
      const [firstName, lastName] = reg.child;
      const [guardianName, guardianPhone, guardianEmail] = reg.guardian;

      // Use pool.query to avoid drizzle circular-type issues with registrationsTable
      await pool.query(
        `INSERT INTO registrations
           (form_id, event_id, child_first_name, child_last_name, child_date_of_birth,
            guardian_name, guardian_phone, guardian_email, allergies, room, submitted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())`,
        [
          form.id,
          event.id,
          firstName,
          lastName,
          reg.dob,
          guardianName,
          guardianPhone,
          guardianEmail ?? null,
          reg.allergies ?? null,
          reg.room ?? null,
        ]
      );
    }

    const n = def.registrations.length;
    console.log(
      `  ✅  "${def.name}" — ${def.fields.length} fields, ${n} registration${n !== 1 ? "s" : ""}`
    );
  }

  console.log("\n✨  Seed complete.");
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
