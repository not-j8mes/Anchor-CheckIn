export interface RegistrationExportRow {
  id: number;
  submittedAt: string;
  firstName: string;
  lastName: string;
  fullName: string;
  childDateOfBirth: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  secondaryGuardianFirstName: string;
  secondaryGuardianLastName: string;
  secondaryGuardianPhone: string;
  secondaryGuardianEmail: string;
  secondaryGuardianRelationship: string;
  allergies: string;
  medicalNotes: string;
  specialNeeds: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  room: string;
  checkinStatus: string;
  checkedInAt: string;
  checkedOutAt: string;
  customAnswers: Record<string, string>;
}

export function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[,"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildCsv(headers: string[], rows: unknown[][]): string {
  return (
    "\uFEFF" +
    [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")
  );
}

export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export interface RegistrationExportData {
  eventName: string;
  rows: RegistrationExportRow[];
  customColumns: string[];
}

export function selectRegistrationExportRows(
  rows: RegistrationExportRow[],
  scope: "all" | "filtered" | "rooms",
  filteredIds: ReadonlySet<number>,
  rooms: readonly string[],
  includeUnassigned: boolean,
): RegistrationExportRow[] {
  if (scope === "filtered") {
    return rows.filter((row) => filteredIds.has(row.id));
  }
  if (scope === "rooms") {
    return rows.filter(
      (row) => rooms.includes(row.room) || (includeUnassigned && !row.room),
    );
  }
  return rows;
}

export async function getEventRegistrationsExport(
  eventId: number,
): Promise<RegistrationExportData> {
  const res = await fetch(`/api/events/${eventId}/registrations/export`);
  if (!res.ok) throw new Error("Export failed");
  return (await res.json()) as RegistrationExportData;
}
