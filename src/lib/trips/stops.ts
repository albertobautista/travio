type StopStay = { arrives_on: string | null; departs_on: string | null };

/** The stop whose stay includes `date` ("YYYY-MM-DD"), if exactly one does. */
export function stopForDate<T extends StopStay>(stops: T[], date: string): T | undefined {
  const matches = stops.filter((s) => s.arrives_on && s.arrives_on <= date && date <= (s.departs_on ?? s.arrives_on));
  return matches.length === 1 ? matches[0] : undefined;
}

/**
 * Every stop whose stay includes `date`, in route order. On a travel day that's
 * two (the city being left and the one being reached), so the itinerary can
 * say "Barcelona → Madrid" instead of nothing.
 */
export function stopsForDate<T extends StopStay & { position: number }>(stops: T[], date: string): T[] {
  return stops
    .filter((s) => s.arrives_on && s.arrives_on <= date && date <= (s.departs_on ?? s.arrives_on))
    .sort((a, b) => a.position - b.position);
}
