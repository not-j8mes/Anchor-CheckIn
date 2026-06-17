export interface RegistrationExportRow {
  id: number;
  submittedAt: string;
  firstName: string;
  lastName: string;
  fullName: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  secondaryGuardianFirstName: string;
  secondaryGuardianLastName: string;
  secondaryGuardianPhone: string;
  secondaryGuardianEmail: string;
  secondaryGuardianRelationship: string;
  allergies: string;
  specialNeeds: string;
  room: string;
  checkinStatus: string;
  checkedInAt: string;
  checkedOutAt: string;
  customAnswers: Record<string, string>;
}

export interface RegistrationExportData {
  eventName: string;
  rows: RegistrationExportRow[];
  customColumns: string[];
}

export async function getEventRegistrationsExport(
  eventId: number,
): Promise<RegistrationExportData> {
  const res = await fetch(`/api/events/${eventId}/registrations/export`);
  if (!res.ok) throw new Error("Export failed");
  return (await res.json()) as RegistrationExportData;
}
