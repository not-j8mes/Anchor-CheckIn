export function defaultReportSessionDate(
  sessionDates: string[],
  today: string,
): string | null {
  const dates = [...new Set(sessionDates)].sort((a, b) => a.localeCompare(b));
  if (!dates.length) return null;
  if (dates.includes(today)) return today;

  const pastDates = dates.filter((date) => date < today);
  return pastDates.at(-1) ?? dates[0] ?? null;
}
