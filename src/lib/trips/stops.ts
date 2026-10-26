type StopStay = { arrives_on: string | null; departs_on: string | null; kind?: string };

/**
 * Kinds of stop. Not every city in the route is somewhere you stay:
 *  - destination: where the trip happens (the default).
 *  - origin: home, where you leave from and come back to. No dates, no stay;
 *    shown first and the drawn route closes back to it.
 *  - transit: a connection (Guadalajara → CDMX → London). Dated, no stay expected.
 */
export const STOP_KINDS = ["destination", "origin", "transit"] as const;
export type StopKind = (typeof STOP_KINDS)[number];

export const STOP_KIND_META: Record<StopKind, { label: string; hint: string }> = {
  destination: { label: "Destino", hint: "Donde te quedas al menos una noche." },
  origin: { label: "Origen", hint: "De donde sales y a donde regresas." },
  transit: { label: "Escala", hint: "Una conexión: pasas por ahí sin hospedarte." },
};

export function isStopKind(value: unknown): value is StopKind {
  return typeof value === "string" && (STOP_KINDS as readonly string[]).includes(value);
}

/** A city of the trip proper: asks for lodging, counts as "the city you're in". */
export const isDestination = (stop: { kind?: string }) => stop.kind !== "origin" && stop.kind !== "transit";

/** The order to show the route in: the origin first (it's home), then by position. */
export function routeOrder<T extends { kind?: string; position: number }>(stops: T[]): T[] {
  return [...stops].sort((a, b) => Number(b.kind === "origin") - Number(a.kind === "origin") || a.position - b.position);
}

/** The route to draw: from the origin through every stop, and back to the origin. */
export function routePath<T extends { kind?: string; position: number }>(stops: T[]): T[] {
  const ordered = routeOrder(stops);
  return ordered[0]?.kind === "origin" && ordered.length > 1 ? [...ordered, ordered[0]] : ordered;
}

const staysOn = (s: StopStay, date: string) => s.arrives_on !== null && s.arrives_on <= date && date <= (s.departs_on ?? s.arrives_on);

/**
 * The stop whose stay includes `date` ("YYYY-MM-DD"), if exactly one does.
 * A connection the same day as a destination gives way to the destination.
 */
export function stopForDate<T extends StopStay>(stops: T[], date: string): T | undefined {
  const matches = stops.filter((s) => staysOn(s, date));
  if (matches.length === 1) return matches[0];
  const destinations = matches.filter(isDestination);
  return destinations.length === 1 ? destinations[0] : undefined;
}

/**
 * Every stop whose stay includes `date`, in route order. On a travel day that's
 * two (the city being left and the one being reached), so the itinerary can
 * say "Barcelona → Madrid" instead of nothing.
 */
export function stopsForDate<T extends StopStay & { position: number }>(stops: T[], date: string): T[] {
  return stops.filter((s) => staysOn(s, date)).sort((a, b) => a.position - b.position);
}
