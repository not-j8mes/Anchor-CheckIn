export class InvalidCustomDatesError extends Error {}

export function normalizeCustomDates(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new InvalidCustomDatesError("Select at least one custom event date.");
  }
  for (const date of value) {
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new InvalidCustomDatesError("Custom dates must use YYYY-MM-DD format.");
    }
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
      throw new InvalidCustomDatesError("Custom dates must be valid calendar dates.");
    }
  }
  return [...new Set(value as string[])].sort();
}
