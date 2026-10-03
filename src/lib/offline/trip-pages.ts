import { getTripStatus } from "@/lib/trips/dates";

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * The pages of a trip worth keeping on the device, or [] if the trip doesn't
 * need them yet. Only the trip in progress, or one starting tomorrow (the
 * night before a flight is when people want their tickets handy).
 *
 * Itinerary: one page per day from today to the end (past days don't matter
 * on the road). Tickets: one page per document; the files themselves are only
 * kept if the user chooses "Descargar para el viaje".
 */
export function offlineTripPages(
  trip: { id: string; start_date: string | null; end_date: string | null },
  today: string,
  fileIds: string[],
) {
  const status = getTripStatus(trip.start_date, trip.end_date, today);
  const startsTomorrow = trip.start_date === addDays(today, 1);
  if (status !== "active" && !startsTomorrow) return [];

  const base = `/viajes/${trip.id}`;
  const paths = [`${base}/hoy`, base, `${base}/itinerario`, `${base}/hospedajes`, `${base}/transporte`, `${base}/documentos`];
  const end = trip.end_date ?? trip.start_date!;
  for (let day = status === "active" ? today : trip.start_date!; day <= end; day = addDays(day, 1)) {
    paths.push(`${base}/itinerario?dia=${day}`);
  }
  for (const id of fileIds) paths.push(`${base}/ticket/${id}`);
  return paths;
}
