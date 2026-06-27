import { pgTable, serial, text, timestamp, foreignKey, integer, boolean, unique } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const organizations = pgTable("organizations", {
	id: serial().primaryKey().notNull(),
	name: text().default('Anchor Events').notNull(),
	logoUrl: text("logo_url"),
	headerText: text("header_text"),
	address: text(),
	phone: text(),
	website: text(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const checkins = pgTable("checkins", {
	id: serial().primaryKey().notNull(),
	registrationId: integer("registration_id").notNull(),
	childFirstName: text("child_first_name").notNull(),
	childLastName: text("child_last_name").notNull(),
	guardianName: text("guardian_name").notNull(),
	checkinAt: timestamp("checkin_at", { mode: 'string' }).defaultNow().notNull(),
	checkoutAt: timestamp("checkout_at", { mode: 'string' }),
	room: text(),
	labelCode: text("label_code").notNull(),
	labelPrinted: boolean("label_printed").default(false).notNull(),
	pickupPersonName: text("pickup_person_name"),
	notes: text(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	sessionId: integer("session_id"),
}, (table) => [
	foreignKey({
			columns: [table.registrationId],
			foreignColumns: [registrations.id],
			name: "checkins_registration_id_registrations_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [eventSessions.id],
			name: "checkins_session_id_event_sessions_id_fk"
		}).onDelete("set null"),
]);

export const forms = pgTable("forms", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	description: text(),
	isActive: boolean("is_active").default(true).notNull(),
	isPublic: boolean("is_public").default(true).notNull(),
	embedSlug: text("embed_slug").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	allowAdditionalPeople: boolean("allow_additional_people").default(false).notNull(),
	showSectionsOneAtATime: boolean("show_sections_one_at_a_time").default(false).notNull(),
	requireStartButton: boolean("require_start_button").default(false).notNull(),
	allowSecondGuardian: boolean("allow_second_guardian"),
	hideOrgLogo: boolean("hide_org_logo").default(false).notNull(),
	hideOrgName: boolean("hide_org_name").default(false).notNull(),
	confirmationEmailEnabled: boolean("confirmation_email_enabled").default(true).notNull(),
	confirmationEmailSubject: text("confirmation_email_subject"),
	confirmationEmailMessage: text("confirmation_email_message"),
}, (table) => [
	unique("forms_embed_slug_unique").on(table.embedSlug),
]);

export const registrations = pgTable("registrations", {
	id: serial().primaryKey().notNull(),
	formId: integer("form_id").notNull(),
	childFirstName: text("child_first_name").notNull(),
	childLastName: text("child_last_name").notNull(),
	childDateOfBirth: text("child_date_of_birth"),
	guardianName: text("guardian_name").notNull(),
	guardianPhone: text("guardian_phone").notNull(),
	guardianEmail: text("guardian_email"),
	secondaryGuardianFirstName: text("secondary_guardian_first_name"),
	secondaryGuardianLastName: text("secondary_guardian_last_name"),
	secondaryGuardianPhone: text("secondary_guardian_phone"),
	secondaryGuardianEmail: text("secondary_guardian_email"),
	secondaryGuardianRelationship: text("secondary_guardian_relationship"),
	allergies: text(),
	specialNeeds: text("special_needs"),
	room: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	eventId: integer("event_id"),
	participantId: integer("participant_id"),
	guardianId: integer("guardian_id"),
	submittedAt: timestamp("submitted_at", { mode: 'string' }),
	registrationGroupId: integer("registration_group_id"),
	formVersionId: integer("form_version_id"),
}, (table) => [
	foreignKey({
			columns: [table.eventId],
			foreignColumns: [events.id],
			name: "registrations_event_id_events_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.formId],
			foreignColumns: [forms.id],
			name: "registrations_form_id_forms_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.formVersionId],
			foreignColumns: [formVersions.id],
			name: "registrations_form_version_id_form_versions_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.guardianId],
			foreignColumns: [guardians.id],
			name: "registrations_guardian_id_guardians_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.participantId],
			foreignColumns: [participants.id],
			name: "registrations_participant_id_participants_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.registrationGroupId],
			foreignColumns: [registrationGroups.id],
			name: "registrations_registration_group_id_registration_groups_id_fk"
		}).onDelete("set null"),
]);

export const questions = pgTable("questions", {
	id: serial().primaryKey().notNull(),
	formId: integer("form_id").notNull(),
	label: text().notNull(),
	type: text().default('text').notNull(),
	required: boolean().default(false).notNull(),
	order: integer().default(0).notNull(),
	placeholder: text(),
	options: text(),
	isChildField: boolean("is_child_field").default(false).notNull(),
	fieldKey: text("field_key"),
}, (table) => [
	foreignKey({
			columns: [table.formId],
			foreignColumns: [forms.id],
			name: "questions_form_id_forms_id_fk"
		}).onDelete("cascade"),
]);

export const answers = pgTable("answers", {
	id: serial().primaryKey().notNull(),
	registrationId: integer("registration_id").notNull(),
	questionId: integer("question_id").notNull(),
	questionLabel: text("question_label").notNull(),
	value: text().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.registrationId],
			foreignColumns: [registrations.id],
			name: "answers_registration_id_registrations_id_fk"
		}).onDelete("cascade"),
]);

export const guardians = pgTable("guardians", {
	id: serial().primaryKey().notNull(),
	firstName: text("first_name").notNull(),
	lastName: text("last_name").notNull(),
	email: text(),
	phone: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const events = pgTable("events", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	eventType: text("event_type").default('general').notNull(),
	startDate: text("start_date"),
	endDate: text("end_date"),
	status: text().default('upcoming').notNull(),
	formId: integer("form_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	registrationType: text("registration_type"),
	trackAttendance: boolean("track_attendance"),
	requireCheckout: boolean("require_checkout"),
	printLabels: boolean("print_labels"),
	labelType: text("label_type"),
	roomAssignmentMode: text("room_assignment_mode"),
	scheduleType: text("schedule_type").default('one_time').notNull(),
	startTime: text("start_time"),
	endTime: text("end_time"),
	repeatFrequency: text("repeat_frequency"),
	repeatDayOfWeek: integer("repeat_day_of_week"),
}, (table) => [
	foreignKey({
			columns: [table.formId],
			foreignColumns: [forms.id],
			name: "events_form_id_forms_id_fk"
		}).onDelete("set null"),
]);

export const emergencyContacts = pgTable("emergency_contacts", {
	id: serial().primaryKey().notNull(),
	participantId: integer("participant_id").notNull(),
	name: text().notNull(),
	phone: text().notNull(),
	relationship: text(),
}, (table) => [
	foreignKey({
			columns: [table.participantId],
			foreignColumns: [participants.id],
			name: "emergency_contacts_participant_id_participants_id_fk"
		}).onDelete("cascade"),
]);

export const participantGuardians = pgTable("participant_guardians", {
	id: serial().primaryKey().notNull(),
	participantId: integer("participant_id").notNull(),
	guardianId: integer("guardian_id").notNull(),
	relationship: text(),
	isPrimary: boolean("is_primary").default(false).notNull(),
	canPickUp: boolean("can_pick_up").default(true).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.guardianId],
			foreignColumns: [guardians.id],
			name: "participant_guardians_guardian_id_guardians_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.participantId],
			foreignColumns: [participants.id],
			name: "participant_guardians_participant_id_participants_id_fk"
		}).onDelete("cascade"),
]);

export const participants = pgTable("participants", {
	id: serial().primaryKey().notNull(),
	firstName: text("first_name").notNull(),
	lastName: text("last_name").notNull(),
	dateOfBirth: text("date_of_birth"),
	gender: text(),
	grade: text(),
	allergies: text(),
	medicalNotes: text("medical_notes"),
	specialNeeds: text("special_needs"),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const registrationCustomAnswers = pgTable("registration_custom_answers", {
	id: serial().primaryKey().notNull(),
	registrationId: integer("registration_id").notNull(),
	formFieldId: integer("form_field_id"),
	questionLabel: text("question_label").notNull(),
	answerValue: text("answer_value").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.formFieldId],
			foreignColumns: [formFields.id],
			name: "registration_custom_answers_form_field_id_form_fields_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.registrationId],
			foreignColumns: [registrations.id],
			name: "registration_custom_answers_registration_id_registrations_id_fk"
		}).onDelete("cascade"),
]);

export const formFields = pgTable("form_fields", {
	id: serial().primaryKey().notNull(),
	formId: integer("form_id").notNull(),
	fieldKind: text("field_kind").default('custom').notNull(),
	systemKey: text("system_key"),
	label: text().notNull(),
	fieldType: text("field_type").default('text').notNull(),
	placeholder: text(),
	required: boolean().default(false).notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	options: text(),
	sectionKey: text("section_key"),
}, (table) => [
	foreignKey({
			columns: [table.formId],
			foreignColumns: [forms.id],
			name: "form_fields_form_id_forms_id_fk"
		}).onDelete("cascade"),
]);

export const registrationGroups = pgTable("registration_groups", {
	id: serial().primaryKey().notNull(),
	eventId: integer("event_id"),
	formId: integer("form_id"),
	primaryRegistrantId: integer("primary_registrant_id"),
	groupName: text("group_name"),
	submittedAt: timestamp("submitted_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.eventId],
			foreignColumns: [events.id],
			name: "registration_groups_event_id_events_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.formId],
			foreignColumns: [forms.id],
			name: "registration_groups_form_id_forms_id_fk"
		}).onDelete("cascade"),
]);

export const formVersions = pgTable("form_versions", {
	id: serial().primaryKey().notNull(),
	formId: integer("form_id").notNull(),
	versionNumber: integer("version_number").notNull(),
	title: text().notNull(),
	description: text(),
	fieldsHash: text("fields_hash"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.formId],
			foreignColumns: [forms.id],
			name: "form_versions_form_id_forms_id_fk"
		}).onDelete("cascade"),
]);

export const formVersionFields = pgTable("form_version_fields", {
	id: serial().primaryKey().notNull(),
	formVersionId: integer("form_version_id").notNull(),
	originalFieldId: integer("original_field_id"),
	fieldKind: text("field_kind").default('custom').notNull(),
	systemKey: text("system_key"),
	label: text().notNull(),
	fieldType: text("field_type").default('text').notNull(),
	placeholder: text(),
	required: boolean().default(false).notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	options: text(),
}, (table) => [
	foreignKey({
			columns: [table.formVersionId],
			foreignColumns: [formVersions.id],
			name: "form_version_fields_form_version_id_form_versions_id_fk"
		}).onDelete("cascade"),
]);

export const rooms = pgTable("rooms", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	capacity: integer(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	eventId: integer("event_id").notNull(),
	description: text(),
	isActive: boolean("is_active").default(true).notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	ageMin: integer("age_min"),
	ageMax: integer("age_max"),
}, (table) => [
	foreignKey({
			columns: [table.eventId],
			foreignColumns: [events.id],
			name: "rooms_event_id_events_id_fk"
		}).onDelete("cascade"),
]);

export const eventCategories = pgTable("event_categories", {
	id: serial().primaryKey().notNull(),
	slug: text().notNull(),
	name: text().notNull(),
	isDefault: boolean("is_default").default(false).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("event_categories_slug_unique").on(table.slug),
	unique("event_categories_name_unique").on(table.name),
]);

export const eventSessions = pgTable("event_sessions", {
	id: serial().primaryKey().notNull(),
	eventId: integer("event_id").notNull(),
	sessionDate: text("session_date").notNull(),
	startTime: text("start_time"),
	endTime: text("end_time"),
	status: text().default('scheduled').notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.eventId],
			foreignColumns: [events.id],
			name: "event_sessions_event_id_events_id_fk"
		}).onDelete("cascade"),
]);
