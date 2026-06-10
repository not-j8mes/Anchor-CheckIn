import { relations } from "drizzle-orm/relations";
import { registrations, checkins, eventSessions, events, forms, formVersions, guardians, participants, registrationGroups, questions, answers, emergencyContacts, participantGuardians, formFields, registrationCustomAnswers, formVersionFields, rooms } from "./schema";

export const checkinsRelations = relations(checkins, ({one}) => ({
	registration: one(registrations, {
		fields: [checkins.registrationId],
		references: [registrations.id]
	}),
	eventSession: one(eventSessions, {
		fields: [checkins.sessionId],
		references: [eventSessions.id]
	}),
}));

export const registrationsRelations = relations(registrations, ({one, many}) => ({
	checkins: many(checkins),
	event: one(events, {
		fields: [registrations.eventId],
		references: [events.id]
	}),
	form: one(forms, {
		fields: [registrations.formId],
		references: [forms.id]
	}),
	formVersion: one(formVersions, {
		fields: [registrations.formVersionId],
		references: [formVersions.id]
	}),
	guardian: one(guardians, {
		fields: [registrations.guardianId],
		references: [guardians.id]
	}),
	participant: one(participants, {
		fields: [registrations.participantId],
		references: [participants.id]
	}),
	registrationGroup: one(registrationGroups, {
		fields: [registrations.registrationGroupId],
		references: [registrationGroups.id]
	}),
	answers: many(answers),
	registrationCustomAnswers: many(registrationCustomAnswers),
}));

export const eventSessionsRelations = relations(eventSessions, ({one, many}) => ({
	checkins: many(checkins),
	event: one(events, {
		fields: [eventSessions.eventId],
		references: [events.id]
	}),
}));

export const eventsRelations = relations(events, ({one, many}) => ({
	registrations: many(registrations),
	form: one(forms, {
		fields: [events.formId],
		references: [forms.id]
	}),
	registrationGroups: many(registrationGroups),
	rooms: many(rooms),
	eventSessions: many(eventSessions),
}));

export const formsRelations = relations(forms, ({many}) => ({
	registrations: many(registrations),
	questions: many(questions),
	events: many(events),
	formFields: many(formFields),
	registrationGroups: many(registrationGroups),
	formVersions: many(formVersions),
}));

export const formVersionsRelations = relations(formVersions, ({one, many}) => ({
	registrations: many(registrations),
	form: one(forms, {
		fields: [formVersions.formId],
		references: [forms.id]
	}),
	formVersionFields: many(formVersionFields),
}));

export const guardiansRelations = relations(guardians, ({many}) => ({
	registrations: many(registrations),
	participantGuardians: many(participantGuardians),
}));

export const participantsRelations = relations(participants, ({many}) => ({
	registrations: many(registrations),
	emergencyContacts: many(emergencyContacts),
	participantGuardians: many(participantGuardians),
}));

export const registrationGroupsRelations = relations(registrationGroups, ({one, many}) => ({
	registrations: many(registrations),
	event: one(events, {
		fields: [registrationGroups.eventId],
		references: [events.id]
	}),
	form: one(forms, {
		fields: [registrationGroups.formId],
		references: [forms.id]
	}),
}));

export const questionsRelations = relations(questions, ({one}) => ({
	form: one(forms, {
		fields: [questions.formId],
		references: [forms.id]
	}),
}));

export const answersRelations = relations(answers, ({one}) => ({
	registration: one(registrations, {
		fields: [answers.registrationId],
		references: [registrations.id]
	}),
}));

export const emergencyContactsRelations = relations(emergencyContacts, ({one}) => ({
	participant: one(participants, {
		fields: [emergencyContacts.participantId],
		references: [participants.id]
	}),
}));

export const participantGuardiansRelations = relations(participantGuardians, ({one}) => ({
	guardian: one(guardians, {
		fields: [participantGuardians.guardianId],
		references: [guardians.id]
	}),
	participant: one(participants, {
		fields: [participantGuardians.participantId],
		references: [participants.id]
	}),
}));

export const registrationCustomAnswersRelations = relations(registrationCustomAnswers, ({one}) => ({
	formField: one(formFields, {
		fields: [registrationCustomAnswers.formFieldId],
		references: [formFields.id]
	}),
	registration: one(registrations, {
		fields: [registrationCustomAnswers.registrationId],
		references: [registrations.id]
	}),
}));

export const formFieldsRelations = relations(formFields, ({one, many}) => ({
	registrationCustomAnswers: many(registrationCustomAnswers),
	form: one(forms, {
		fields: [formFields.formId],
		references: [forms.id]
	}),
}));

export const formVersionFieldsRelations = relations(formVersionFields, ({one}) => ({
	formVersion: one(formVersions, {
		fields: [formVersionFields.formVersionId],
		references: [formVersions.id]
	}),
}));

export const roomsRelations = relations(rooms, ({one}) => ({
	event: one(events, {
		fields: [rooms.eventId],
		references: [events.id]
	}),
}));