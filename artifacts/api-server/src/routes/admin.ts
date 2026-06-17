import { Router } from "express";
import {
  db,
  eventsTable,
  formsTable,
  eventCategoriesTable,
  roomsTable,
  registrationGroupsTable,
  registrationsTable,
  participantsTable,
  guardiansTable,
  participantGuardiansTable,
  emergencyContactsTable,
} from "@workspace/db";
import { createEventWithForm } from "./events";
import {
  randomKidFirstName,
  randomAdultFirstName,
  randomLastName,
  randomAllergies,
  randomMedicalNotes,
  randomEmergencyContact,
  randomPhone,
  randomEmail,
  dobForAge,
  randomInt,
  nextDateForDow,
} from "../lib/testData";

const router = Router();

router.delete("/admin/reset", async (req, res) => {
  try {
    // Delete all events (sets formId to null via onDelete: "set null")
    await db.delete(eventsTable);
    // Delete all forms — cascades to questions, registrations, answers, check-ins
    await db.delete(formsTable);
    // Delete normalized person/contact records; dependent participant_guardians
    // and emergency_contacts rows cascade from these deletes.
    await db.delete(participantsTable);
    await db.delete(guardiansTable);
    // Delete all event categories
    await db.delete(eventCategoriesTable);
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to reset all data");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /admin/seed-test-data ───────────────────────────────────────────────
// Creates 3 demo events (child check-in, family/group, individual) with rooms
// and a realistic batch of registrants, for exercising the app without
// manually filling out forms. Surfaced as the "Add Test Data" button in Settings.

interface RegistrantInput {
  firstName: string;
  lastName: string;
  dob?: string | null;
  guardianId?: number;
  contactFirstName?: string;
  contactLastName?: string;
  contactPhone: string;
  contactEmail?: string | null;
  allergies?: string | null;
  medicalNotes?: string | null;
  specialNeeds?: string | null;
  emergencyName?: string | null;
  emergencyPhone?: string | null;
  emergencyRelationship?: string | null;
  room?: string | null;
}

interface GuardianContact {
  first: string;
  last: string;
  phone: string;
  email: string;
}

async function createGroup(eventId: number, formId: number): Promise<number> {
  const [group] = await db
    .insert(registrationGroupsTable)
    .values({ eventId, formId, submittedAt: new Date() })
    .returning();
  return group.id;
}

async function createGuardian(contact: GuardianContact) {
  const [guardian] = await db
    .insert(guardiansTable)
    .values({
      firstName: contact.first,
      lastName: contact.last,
      phone: contact.phone,
      email: contact.email,
    })
    .returning();
  return guardian;
}

async function createRegistration(
  eventId: number,
  formId: number,
  groupId: number,
  input: RegistrantInput
) {
  const contactFirstName = input.contactFirstName ?? input.firstName;
  const contactLastName = input.contactLastName ?? input.lastName;

  const [participant] = await db
    .insert(participantsTable)
    .values({
      firstName: input.firstName,
      lastName: input.lastName,
      dateOfBirth: input.dob ?? null,
      allergies: input.allergies ?? null,
      medicalNotes: input.medicalNotes ?? null,
      specialNeeds: input.specialNeeds ?? null,
    })
    .returning();

  const guardian = input.guardianId
    ? { id: input.guardianId }
    : await createGuardian({
        first: contactFirstName,
        last: contactLastName,
        phone: input.contactPhone,
        email: input.contactEmail ?? "",
      });

  await db.insert(participantGuardiansTable).values({
    participantId: participant.id,
    guardianId: guardian.id,
    isPrimary: true,
    canPickUp: true,
  });

  if (input.emergencyName) {
    await db.insert(emergencyContactsTable).values({
      participantId: participant.id,
      name: input.emergencyName,
      phone: input.emergencyPhone ?? "",
      relationship: input.emergencyRelationship ?? null,
    });
  }

  const [registration] = await db
    .insert(registrationsTable)
    .values({
      formId,
      eventId,
      participantId: participant.id,
      guardianId: guardian.id,
      registrationGroupId: groupId,
      submittedAt: new Date(),
      childFirstName: input.firstName,
      childLastName: input.lastName,
      childDateOfBirth: input.dob ?? null,
      guardianName: `${contactFirstName} ${contactLastName}`,
      guardianPhone: input.contactPhone,
      guardianEmail: input.contactEmail ?? null,
      allergies: input.allergies ?? null,
      medicalNotes: input.medicalNotes ?? null,
      specialNeeds: input.specialNeeds ?? null,
      emergencyContactName: input.emergencyName ?? null,
      emergencyContactPhone: input.emergencyPhone ?? null,
      emergencyContactRelationship: input.emergencyRelationship ?? null,
      room: input.room ?? null,
    })
    .returning();

  return registration;
}

interface RoomDef {
  name: string;
  description: string;
  capacity: number;
  ageMin: number;
  ageMax: number;
}

const CHILD_ROOMS: RoomDef[] = [
  { name: "Nursery", description: "Infants & crawlers", capacity: 12, ageMin: 0, ageMax: 1 },
  { name: "Toddlers", description: "Walking toddlers", capacity: 15, ageMin: 2, ageMax: 3 },
  { name: "Preschool", description: "Pre-K", capacity: 20, ageMin: 4, ageMax: 5 },
  { name: "Elementary", description: "Grades K-5", capacity: 30, ageMin: 6, ageMax: 10 },
];

function roomForAge(age: number): RoomDef {
  return CHILD_ROOMS.find((r) => age >= r.ageMin && age <= r.ageMax) ?? CHILD_ROOMS[CHILD_ROOMS.length - 1]!;
}

async function seedChildCheckinEvent(): Promise<number> {
  const { event, form } = await createEventWithForm({
    name: "Sunday Kids Check-In",
    description: "Weekly children's ministry check-in for nursery through elementary kids.",
    eventType: "general",
    registrationType: "child_checkin",
    scheduleType: "one_time",
    startDate: nextDateForDow(0),
    endDate: nextDateForDow(0),
    startTime: "09:00",
    endTime: "10:30",
    formTitle: "Sunday Kids Check-In Registration",
    formDescription: "Register your child for Sunday morning kids check-in.",
    addDefaultQuestions: true,
    trackAttendance: true,
    requireCheckout: true,
    printLabels: true,
    labelType: "child_security",
  });

  await db.insert(roomsTable).values(
    CHILD_ROOMS.map((r, i) => ({
      eventId: event.id,
      name: r.name,
      description: r.description,
      capacity: r.capacity,
      ageMin: r.ageMin,
      ageMax: r.ageMax,
      sortOrder: i,
    }))
  );

  let count = 0;

  const addChild = async (groupId: number, guardian: GuardianContact & { id?: number }) => {
    const firstName = randomKidFirstName();
    const lastName = guardian.last;
    const age = randomInt(0, 10);
    const ec = randomEmergencyContact(lastName);
    await createRegistration(event.id, form.id, groupId, {
      firstName,
      lastName,
      dob: dobForAge(age),
      guardianId: guardian.id,
      contactFirstName: guardian.first,
      contactLastName: guardian.last,
      contactPhone: guardian.phone,
      contactEmail: guardian.email,
      allergies: randomAllergies(),
      medicalNotes: randomMedicalNotes(),
      emergencyName: ec.name,
      emergencyPhone: ec.phone,
      emergencyRelationship: ec.relationship,
      room: roomForAge(age).name,
    });
    count++;
  };

  // 6 single-child registrations, each their own family
  for (let i = 0; i < 6; i++) {
    const last = randomLastName();
    const guardian = { first: randomAdultFirstName(), last, phone: randomPhone(), email: randomEmail(randomAdultFirstName(), last) };
    const groupId = await createGroup(event.id, form.id);
    await addChild(groupId, guardian);
  }

  // 3 families with 2 kids who share a guardian + group
  for (let i = 0; i < 3; i++) {
    const last = randomLastName();
    const guardian = { first: randomAdultFirstName(), last, phone: randomPhone(), email: randomEmail(randomAdultFirstName(), last) };
    const sharedGuardian = await createGuardian(guardian);
    const groupId = await createGroup(event.id, form.id);
    await addChild(groupId, { ...guardian, id: sharedGuardian.id });
    await addChild(groupId, { ...guardian, id: sharedGuardian.id });
  }

  // 1 family with 3 kids
  {
    const last = randomLastName();
    const guardian = { first: randomAdultFirstName(), last, phone: randomPhone(), email: randomEmail(randomAdultFirstName(), last) };
    const sharedGuardian = await createGuardian(guardian);
    const groupId = await createGroup(event.id, form.id);
    await addChild(groupId, { ...guardian, id: sharedGuardian.id });
    await addChild(groupId, { ...guardian, id: sharedGuardian.id });
    await addChild(groupId, { ...guardian, id: sharedGuardian.id });
  }

  return count;
}

async function seedFamilyGroupEvent(): Promise<number> {
  const { event, form } = await createEventWithForm({
    name: "Young Adults Retreat",
    description: "Weekend retreat sign-up — register yourself and anyone else attending in your group.",
    eventType: "general",
    registrationType: "family_group",
    scheduleType: "one_time",
    startDate: nextDateForDow(5),
    endDate: nextDateForDow(5),
    startTime: "18:00",
    endTime: "20:00",
    formTitle: "Young Adults Retreat Sign-Up",
    formDescription: "Sign up yourself or your whole group for the retreat.",
    addDefaultQuestions: true,
    trackAttendance: false,
    requireCheckout: false,
    printLabels: false,
  });

  let count = 0;

  const addPerson = async (groupId: number) => {
    const firstName = randomAdultFirstName();
    const lastName = randomLastName();
    await createRegistration(event.id, form.id, groupId, {
      firstName,
      lastName,
      contactPhone: randomPhone(),
      contactEmail: randomEmail(firstName, lastName),
      specialNeeds: Math.random() < 0.15 ? "Wheelchair accessible seating" : null,
    });
    count++;
  };

  // 4 solo signups
  for (let i = 0; i < 4; i++) {
    const groupId = await createGroup(event.id, form.id);
    await addPerson(groupId);
  }

  // 3 pairs registering together
  for (let i = 0; i < 3; i++) {
    const groupId = await createGroup(event.id, form.id);
    await addPerson(groupId);
    await addPerson(groupId);
  }

  // 1 trio
  {
    const groupId = await createGroup(event.id, form.id);
    await addPerson(groupId);
    await addPerson(groupId);
    await addPerson(groupId);
  }

  return count;
}

async function seedIndividualEvent(): Promise<number> {
  const { event, form } = await createEventWithForm({
    name: "Fall 5K Fun Run",
    description: "Each runner registers individually for the Fall 5K Fun Run.",
    eventType: "general",
    registrationType: "individual",
    scheduleType: "one_time",
    startDate: nextDateForDow(6),
    endDate: nextDateForDow(6),
    startTime: "08:00",
    endTime: "09:30",
    formTitle: "Fall 5K Fun Run Registration",
    formDescription: "Register to run or walk the Fall 5K.",
    addDefaultQuestions: true,
    trackAttendance: false,
    requireCheckout: false,
    printLabels: false,
  });

  let count = 0;

  for (let i = 0; i < 14; i++) {
    const firstName = randomAdultFirstName();
    const lastName = randomLastName();
    const groupId = await createGroup(event.id, form.id);
    await createRegistration(event.id, form.id, groupId, {
      firstName,
      lastName,
      contactPhone: randomPhone(),
      contactEmail: randomEmail(firstName, lastName),
      specialNeeds: Math.random() < 0.1 ? "Walking the course, not running" : null,
    });
    count++;
  }

  return count;
}

router.post("/admin/seed-test-data", async (req, res) => {
  try {
    const childCount = await seedChildCheckinEvent();
    const groupCount = await seedFamilyGroupEvent();
    const individualCount = await seedIndividualEvent();

    res.status(201).json({
      eventsCreated: 3,
      registrationsCreated: childCount + groupCount + individualCount,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to seed test data");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
