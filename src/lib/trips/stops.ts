type StopStay = { arrives_on: string | null; departs_on: string | null };

/** The stop whose stay includes `date` ("YYYY-MM-DD"), if exactly one does. */
export function stopForDate<T extends StopStay>(stops: T[], date: string): T | undefined {
  const matches = stops.filter((s) => s.arrives_on && s.arrives_on <= date && date <= (s.departs_on ?? s.arrives_on));
  return matches.length === 1 ? matches[0] : undefined;
}
